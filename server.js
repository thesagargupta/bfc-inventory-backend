const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
require('dotenv').config();
const mongoose = require('mongoose');
const multer = require('multer');
const compression = require('compression');
const NodeCache = require('node-cache');

const app = express();
const PORT = 5000;

// Create a new cache object with a standard TTL of 1 hour
const cache = new NodeCache({ stdTTL: 3600 });

app.use(cors());
app.use(compression()); // Add compression middleware
app.use(express.json({ limit: '10mb' }));

// Set up multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Category/Item Schema
const ItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  unit: { type: String, required: true }
});

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  items: [ItemSchema]
});

const Category = mongoose.model('Category', CategorySchema);

// In-memory tracking of last submission dates per branch
const submissionTracker = new Map();

// Helper to get YYYY-MM-DD string
const getTodayDateString = () => new Date().toISOString().split('T')[0];

// Helper to get date N days ago
const getDateNDaysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
};

// API: Get all categories and items (for frontend)
app.get('/api/categories', async (req, res) => {
  try {
    // Check if the data is in the cache
    const cachedCategories = cache.get('categories');
    if (cachedCategories) {
      return res.json(cachedCategories);
    }

    // If not in cache, fetch from the database
    const categories = await Category.find({});
    
    // Store the data in the cache
    cache.set('categories', categories);
    
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// API: Add or update a category (for admin panel)
app.post('/api/categories', async (req, res) => {
  const { name, items } = req.body;
  if (!name || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Name and items are required' });
  }
  try {
    let category = await Category.findOne({ name });
    if (category) {
      // Merge items by name (case-insensitive), update unit if exists, add if not
      const itemMap = new Map();
      // Add existing items (use lowercased name as key)
      category.items.forEach(i => {
        itemMap.set(i.name.trim().toLowerCase(), { name: i.name, unit: i.unit });
      });
      // Add/update from new items
      items.forEach(newItem => {
        const key = newItem.name.trim().toLowerCase();
        itemMap.set(key, { name: newItem.name, unit: newItem.unit });
      });
      // Save merged unique items (preserve original casing from newItem if updated)
      category.items = Array.from(itemMap.values());
      await category.save();
    } else {
      category = new Category({ name, items });
      await category.save();
    }
    
    // Invalidate the cache
    cache.del('categories');
    
    res.json({ message: 'Category saved', category });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save category' });
  }
});

// API: Bulk add categories and items
app.post('/api/categories/bulk', async (req, res) => {
  const bulkData = req.body;

  if (typeof bulkData !== 'object' || bulkData === null) {
    return res.status(400).json({ error: 'Invalid data format. Expecting an object of categories.' });
  }

  try {
    const promises = [];
    for (const categoryName in bulkData) {
      if (bulkData.hasOwnProperty(categoryName)) {
        const items = bulkData[categoryName];
        const promise = (async () => {
          let category = await Category.findOne({ name: categoryName });

          if (!category) {
            category = new Category({ name: categoryName, items: [] });
          }

          const existingItems = new Set(category.items.map(item => item.name.toLowerCase()));

          for (const itemName in items) {
            if (items.hasOwnProperty(itemName)) {
              const unit = items[itemName];
              if (!existingItems.has(itemName.toLowerCase())) {
                category.items.push({ name: itemName, unit: unit });
              }
            }
          }
          await category.save();
        })();
        promises.push(promise);
      }
    }
    await Promise.all(promises);
    
    // Invalidate the cache
    cache.del('categories');
    
    res.json({ message: 'Bulk data added successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process bulk data.' });
  }
});

// API: Bulk add categories and items from JSON file
app.post('/api/categories/bulk-upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  try {
    const bulkData = JSON.parse(req.file.buffer.toString());

    if (typeof bulkData !== 'object' || bulkData === null) {
      return res.status(400).json({ error: 'Invalid data format. Expecting an object of categories.' });
    }

    const promises = [];
    for (const categoryName in bulkData) {
      if (bulkData.hasOwnProperty(categoryName)) {
        const items = bulkData[categoryName];
        const promise = (async () => {
          let category = await Category.findOne({ name: categoryName });

          if (!category) {
            category = new Category({ name: categoryName, items: [] });
          }

          const existingItems = new Set(category.items.map(item => item.name.toLowerCase()));

          for (const itemName in items) {
            if (items.hasOwnProperty(itemName)) {
              const unit = items[itemName];
              if (!existingItems.has(itemName.toLowerCase())) {
                category.items.push({ name: itemName, unit: unit });
              }
            }
          }
          await category.save();
        })();
        promises.push(promise);
      }
    }
    await Promise.all(promises);
    
    // Invalidate the cache
    cache.del('categories');
    
    res.json({ message: 'Bulk data added successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process bulk data.' });
  }
});

// API: Delete a category (for admin panel)
app.delete('/api/categories/:name', async (req, res) => {
  try {
    await Category.deleteOne({ name: req.params.name });
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// API: Delete specific items from a category (for admin panel)
app.post('/api/categories/:name/delete-items', async (req, res) => {
  const { itemsToDelete } = req.body;
  const categoryName = req.params.name;
  
  if (!Array.isArray(itemsToDelete) || itemsToDelete.length === 0) {
    return res.status(400).json({ error: 'Items to delete are required' });
  }
  
  try {
    const category = await Category.findOne({ name: categoryName });
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Filter out the items to delete (case-insensitive comparison)
    category.items = category.items.filter(item => 
      !itemsToDelete.some(itemToDelete => 
        item.name.toLowerCase() === itemToDelete.toLowerCase()
      )
    );
    
    await category.save();
    res.json({ message: 'Items deleted successfully', category });
  } catch (err) {
    console.error('Error deleting items:', err);
    res.status(500).json({ error: 'Failed to delete items' });
  }
});

// Google Sheets configuration - Single spreadsheet with branch names as sheet names
const GOOGLE_SHEETS_CONFIG = {
  'Chandigarh': {
    spreadsheetId: process.env.DELHI_SHEET_ID,
    range: 'Chandigarh!A:J', // A:J to accommodate Category, Item, Unit, and 7 date columns
    sheetName: 'Chandigarh'
  },
  'Delhi': {
    spreadsheetId: process.env.DELHI_SHEET_ID,
    range: 'Delhi!A:J',
    sheetName: 'Delhi'
  },
  'Gurugram': {
    spreadsheetId: process.env.DELHI_SHEET_ID,
    range: 'Gurugram!A:J',
    sheetName: 'Gurugram'
  }
};

// Initialize Google Sheets API
const initializeGoogleSheets = () => {
  const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return google.sheets({ version: 'v4', auth });
};

// Function to ensure required sheets exist and initialize with fixed structure
const ensureSheetExists = async (sheets, spreadsheetId, sheetName) => {
  try {
    // Get spreadsheet info to check existing sheets
    const spreadsheetInfo = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId
    });

    const existingSheets = spreadsheetInfo.data.sheets.map(sheet => sheet.properties.title);
    
    // If sheet doesn't exist, create it
    if (!existingSheets.includes(sheetName)) {
      console.log(`Creating sheet: ${sheetName}`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId,
        resource: {
          requests: [{
            addSheet: {
              properties: {
                title: sheetName
              }
            }
          }]
        }
      });
      console.log(`Sheet ${sheetName} created successfully`);
      
      // Initialize sheet with fixed structure
      await initializeSheetStructure(sheets, spreadsheetId, sheetName);
    } else {
      console.log(`Sheet ${sheetName} already exists`);
    }
  } catch (error) {
    console.error(`Error ensuring sheet ${sheetName} exists:`, error);
    throw error;
  }
};

// Function to initialize sheet with fixed structure and dynamic date columns (from DB)
const initializeSheetStructure = async (sheets, spreadsheetId, sheetName) => {
  try {
    // Prepare 7 date columns: today, yesterday, ..., 6 days ago
    const dateColumns = [];
    for (let i = 0; i < 7; i++) {
      dateColumns.push(getDateNDaysAgo(i));
    }

    // Fetch all categories/items/units from DB
    const categories = await mongoose.model('Category').find({});

    // Create fixed structure with all items from all categories
    const fixedData = [
      ['Category', 'Item', 'Unit', ...dateColumns.map(date => `${date} (Qty)`)] // Headers with 7 date columns
    ];

    // Add all items from all categories
    categories.forEach(categoryDoc => {
      const category = categoryDoc.name;
      categoryDoc.items.forEach(itemObj => {
        fixedData.push([category, itemObj.name, itemObj.unit, ...Array(7).fill('')]);
      });
    });

    const range = `${sheetName}!A:J`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: range,
      valueInputOption: 'RAW',
      requestBody: {
        values: fixedData
      }
    });

    console.log(`Fixed structure initialized for sheet: ${sheetName} with 7 date columns`);
  } catch (error) {
    console.error(`Error initializing sheet structure for ${sheetName}:`, error);
    throw error;
  }
};

// Function to manage 7-day rolling data with dynamic date columns (from DB)
const manageRollingData = async (sheets, spreadsheetId, sheetName, newData) => {
  try {
    const range = `${sheetName}!A:J`;

    // Get current data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: range
    });

    const currentData = response.data.values || [];
    if (currentData.length === 0 || currentData.length === 1) { // Also check for only headers
      // If no data, or only headers, initialize with fixed structure
      await initializeSheetStructure(sheets, spreadsheetId, sheetName);
      // Re-fetch the data after initialization
      const reFetchedResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: range
      });
      currentData = reFetchedResponse.data.values || [];
    }

    const headers = currentData[0];
    const dataRows = currentData.slice(1);

    // Prepare 7 date columns: today, yesterday, ..., 6 days ago
    const dateColumns = [];
    for (let i = 0; i < 7; i++) {
      dateColumns.push(getDateNDaysAgo(i));
    }
    const today = getTodayDateString();

    // Find the index of today's date column
    const todayColumnIndex = dateColumns.indexOf(today) + 3; // +3 for Category, Item, Unit

    // Create new headers with rolling 7-day date columns
    const newHeaders = ['Category', 'Item', 'Unit', ...dateColumns.map(date => `${date} (Qty)`)];

    // Fetch all categories/items/units from DB
    const allCategories = await mongoose.model('Category').find({});

    // Create a map for quick lookup of existing data
    const existingDataMap = new Map();
    dataRows.forEach(row => {
      const [category, item] = row;
      if (category && item) {
        existingDataMap.set(`${category}-${item}`, row);
      }
    });

    // Build the final data structure
    const finalData = [newHeaders];

    allCategories.forEach(categoryDoc => {
      const categoryName = categoryDoc.name;
      categoryDoc.items.forEach(itemObj => {
        const itemKey = `${categoryName}-${itemObj.name}`;
        
        let row = existingDataMap.get(itemKey);
        
        if (!row) {
          // This item doesn't exist in the current sheet data, create a new row
          row = [categoryName, itemObj.name, itemObj.unit, ...Array(7).fill('')];
        } else {
          // It exists, so make sure it has the right number of columns
          // and shift old data if necessary
          row.length = 10; // Ensure exactly 10 columns (3 + 7 dates)
          
          // Clear the old today's data and shift previous data to the right
          row.splice(3, 1, ...row.slice(3, 9));
          row[3] = ''; // Set new today's column to blank initially
        }

        // Now, update today's column with the new submitted quantity
        const submittedItemData = newData[itemObj.name];
        if (submittedItemData && submittedItemData.quantity) {
          row[todayColumnIndex] = submittedItemData.quantity;
        }

        finalData.push(row);
      });
    });

    return { data: { values: finalData } };
  } catch (error) {
    console.error(`Error managing rolling data for ${sheetName}:`, error);
    throw error;
  }
};

// Endpoint to update Google Sheets and track submission
app.post('/update-sheets', async (req, res) => {
  const { data, branch } = req.body;

  if (!data || !branch) {
    return res.status(400).json({ error: 'Data and branch are required' });
  }

  if (!GOOGLE_SHEETS_CONFIG[branch]) {
    return res.status(400).json({ error: 'Invalid branch' });
  }

  try {
    console.log(`Attempting to update Google Sheets for branch: ${branch}`);
    
    const sheets = initializeGoogleSheets();
    const config = GOOGLE_SHEETS_CONFIG[branch];
    
    console.log(`Using spreadsheet ID: ${config.spreadsheetId}`);
    console.log(`Target sheet: ${config.sheetName}`);
    console.log(`Data received:`, data);
    
    // Ensure the required sheet exists
    await ensureSheetExists(sheets, config.spreadsheetId, config.sheetName);
    
    // Manage 7-day rolling data
    const updatedData = await manageRollingData(sheets, config.spreadsheetId, config.sheetName, data);
    
    // Update the sheet with the processed data
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.spreadsheetId,
      range: config.range,
      valueInputOption: 'RAW',
      requestBody: {
        values: updatedData.data.values
      }
    });

    console.log(`Successfully updated Google Sheets for branch: ${branch} in ${config.sheetName}`);

    // Save submission date for the branch
    const today = getTodayDateString();
    submissionTracker.set(branch, today);

    res.status(200).json({ 
      message: `Google Sheets updated successfully for ${branch}`,
      details: `Data maintained for last 7 days with dynamic date columns in ${config.sheetName} sheet`
    });
  } catch (err) {
    console.error('Error updating Google Sheets:', err);
    console.error('Error details:', err.message);
    console.error('Stack trace:', err.stack);
    res.status(500).json({ error: 'Failed to update Google Sheets: ' + err.message });
  }
});

// Endpoint to fetch last submission date for a branch
app.get('/last-submission/:branch', (req, res) => {
  const { branch } = req.params;
  if (!branch) return res.status(400).json({ error: 'Branch is required' });

  const lastDate = submissionTracker.get(branch) || null;
  res.status(200).json({ branch, date: lastDate });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});