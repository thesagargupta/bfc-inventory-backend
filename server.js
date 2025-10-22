const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
require('dotenv').config();
const mongoose = require('mongoose');
const multer = require('multer');
const compression = require('compression');
const NodeCache = require('node-cache');
const XLSX = require('xlsx');

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

// API: Upload and process Excel file for categories and items
app.post('/api/categories/excel-upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  try {
    // Parse Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0]; // Get first sheet
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    if (!data || data.length === 0) {
      return res.status(400).json({ error: 'Excel file is empty or invalid format.' });
    }

    // Validate columns - expect: Category, Item Name, Unit (case-insensitive)
    const firstRow = data[0];
    const hasCategory = Object.keys(firstRow).some(key => key.toLowerCase().includes('category'));
    const hasItemName = Object.keys(firstRow).some(key => key.toLowerCase().includes('item'));
    const hasUnit = Object.keys(firstRow).some(key => key.toLowerCase().includes('unit'));

    if (!hasCategory || !hasItemName || !hasUnit) {
      return res.status(400).json({ 
        error: 'Invalid Excel format. Expected columns: Category, Item Name, Unit',
        receivedColumns: Object.keys(firstRow)
      });
    }

    // Group data by category
    const categorizedData = {};
    let processedCount = 0;
    let skippedCount = 0;

    data.forEach((row) => {
      // Find the column names (case-insensitive)
      const categoryKey = Object.keys(row).find(key => key.toLowerCase().includes('category'));
      const itemKey = Object.keys(row).find(key => key.toLowerCase().includes('item'));
      const unitKey = Object.keys(row).find(key => key.toLowerCase().includes('unit'));

      const categoryName = row[categoryKey]?.toString().trim();
      const itemName = row[itemKey]?.toString().trim();
      const unit = row[unitKey]?.toString().trim();

      // Skip rows with missing data
      if (!categoryName || !itemName || !unit) {
        skippedCount++;
        return;
      }

      if (!categorizedData[categoryName]) {
        categorizedData[categoryName] = [];
      }

      categorizedData[categoryName].push({ name: itemName, unit: unit });
      processedCount++;
    });

    // Save to database
    const promises = [];
    for (const categoryName in categorizedData) {
      const items = categorizedData[categoryName];
      const promise = (async () => {
        let category = await Category.findOne({ name: categoryName });

        if (!category) {
          category = new Category({ name: categoryName, items: [] });
        }

        // Create a map of existing items (case-insensitive)
        const itemMap = new Map();
        category.items.forEach(item => {
          itemMap.set(item.name.trim().toLowerCase(), { name: item.name, unit: item.unit });
        });

        // Add/update items from Excel
        items.forEach(newItem => {
          const key = newItem.name.trim().toLowerCase();
          itemMap.set(key, { name: newItem.name, unit: newItem.unit });
        });

        // Save merged items
        category.items = Array.from(itemMap.values());
        await category.save();
      })();
      promises.push(promise);
    }

    await Promise.all(promises);

    // Invalidate the cache
    cache.del('categories');

    res.json({ 
      message: 'Excel data processed successfully',
      stats: {
        categoriesProcessed: Object.keys(categorizedData).length,
        itemsProcessed: processedCount,
        itemsSkipped: skippedCount
      }
    });
  } catch (err) {
    console.error('Excel upload error:', err);
    res.status(500).json({ error: 'Failed to process Excel file: ' + err.message });
  }
});

// API: Delete a category (for admin panel)
app.delete('/api/categories/:name', async (req, res) => {
  try {
    await Category.deleteOne({ name: req.params.name });
    
    // Invalidate the cache
    cache.del('categories');
    
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

    // Invalidate the cache
    cache.del('categories');
    
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
    range: 'Chandigarh!A:R', // A:R to accommodate Category, Item, Unit, and 15 date columns
    sheetName: 'Chandigarh'
  },
  'Delhi': {
    spreadsheetId: process.env.DELHI_SHEET_ID,
    range: 'Delhi!A:R', // A:R for 18 columns (3 fixed + 15 dates)
    sheetName: 'Delhi'
  },
  'Gurugram': {
    spreadsheetId: process.env.DELHI_SHEET_ID,
    range: 'Gurugram!A:R', // A:R for 18 columns (3 fixed + 15 dates)
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
    // Prepare 15 date columns: today, yesterday, ..., 14 days ago
    const dateColumns = [];
    for (let i = 0; i < 15; i++) {
      dateColumns.push(getDateNDaysAgo(i));
    }

    // Fetch all categories/items/units from DB
    const categories = await mongoose.model('Category').find({});

    // Create fixed structure with all items from all categories
    const fixedData = [
      ['Category', 'Item', 'Unit', ...dateColumns.map(date => `${date} (Qty)`)] // Headers with 15 date columns
    ];

    // Add all items from all categories
    categories.forEach(categoryDoc => {
      const category = categoryDoc.name;
      categoryDoc.items.forEach(itemObj => {
        fixedData.push([category, itemObj.name, itemObj.unit, ...Array(15).fill('')]);
      });
    });

    const range = `${sheetName}!A:R`; // 18 columns: A-R
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: range,
      valueInputOption: 'RAW',
      requestBody: {
        values: fixedData
      }
    });

    console.log(`✅ Fixed structure initialized for sheet: ${sheetName} with 15 date columns (18 total columns)`);
  } catch (error) {
    console.error(`Error initializing sheet structure for ${sheetName}:`, error);
    throw error;
  }
};

// Function to manage 15-day rolling data with dynamic date columns (from DB)
// This function preserves existing data and only updates data for the current submission date
const manageRollingData = async (sheets, spreadsheetId, sheetName, newData) => {
  try {
    const range = `${sheetName}!A:R`; // 18 columns: 3 fixed + 15 date columns

    // Get current data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: range
    });

    let currentData = response.data.values || [];
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

    const headers = currentData[0] || [];
    const dataRows = currentData.slice(1);

    console.log(`\n📋 Current sheet has ${headers.length} columns and ${dataRows.length} data rows`);

    // Prepare 15 date columns: today, yesterday, ..., 14 days ago
    const dateColumns = [];
    for (let i = 0; i < 15; i++) {
      dateColumns.push(getDateNDaysAgo(i));
    }
    const today = getTodayDateString();

    console.log(`📅 Today's date: ${today}`);
    console.log(`📅 Date columns to create: [${dateColumns[0]}, ${dateColumns[1]}, ..., ${dateColumns[14]}]`);

    // Find the index of today's date column in the new structure
    const todayColumnIndex = dateColumns.indexOf(today) + 3; // +3 for Category, Item, Unit
    
    console.log(`📍 Today's column index will be: ${todayColumnIndex} (column ${String.fromCharCode(65 + todayColumnIndex)})`);

    // Create new headers with rolling 15-day date columns
    const newHeaders = ['Category', 'Item', 'Unit', ...dateColumns.map(date => `${date} (Qty)`)];

    // Fetch all categories/items/units from DB
    const allCategories = await mongoose.model('Category').find({});

    // Parse existing data to preserve values
    const existingDataMap = new Map();
    dataRows.forEach(row => {
      const [category, item] = row;
      if (category && item) {
        // Store the entire row data (preserve all columns including quantities)
        existingDataMap.set(`${category}-${item}`, row);
      }
    });

    console.log(`📦 Found ${existingDataMap.size} existing items in sheet ${sheetName}`);

    // Parse existing headers to map old date columns to new ones
    const oldDateIndexMap = new Map();
    if (headers.length > 3) {
      for (let i = 3; i < headers.length; i++) {
        const headerText = headers[i];
        // Extract date from header like "2025-10-07 (Qty)"
        const dateMatch = headerText.match(/^(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          oldDateIndexMap.set(dateMatch[1], i);
        }
      }
    }

    console.log(`🗺️  Old date column mapping: ${Array.from(oldDateIndexMap.entries()).map(([d, i]) => `${d}→col${i}`).join(', ')}`);
    console.log(`\n🔄 Processing submission for date: ${today}`);
    console.log(`📝 Updating ${Object.keys(newData).length} items in the submission: [${Object.keys(newData).join(', ')}]\n`);

    // Build the final data structure
    const finalData = [newHeaders];

    let updatedCount = 0;
    let preservedCount = 0;
    let newItemCount = 0;

    allCategories.forEach(categoryDoc => {
      const categoryName = categoryDoc.name;
      categoryDoc.items.forEach(itemObj => {
        const itemKey = `${categoryName}-${itemObj.name}`;
        
        // Create a new row with 18 columns (3 + 15 dates)
        const newRow = [categoryName, itemObj.name, itemObj.unit, ...Array(15).fill('')];
        
        const existingRow = existingDataMap.get(itemKey);
        
        if (existingRow) {
          // Preserve existing data by mapping old date columns to new date columns
          dateColumns.forEach((date, newIndex) => {
            const oldColumnIndex = oldDateIndexMap.get(date);
            if (oldColumnIndex !== undefined && existingRow[oldColumnIndex] !== undefined && existingRow[oldColumnIndex] !== '') {
              newRow[3 + newIndex] = existingRow[oldColumnIndex];
            }
          });
        }

        // Update/merge today's column with the new submitted quantity
        // Only update if this specific item was submitted in the current request
        const submittedItemData = newData[itemObj.name];
        if (submittedItemData && submittedItemData.quantity) {
          const oldValue = newRow[todayColumnIndex];
          // Update this item's quantity for today (this will overwrite existing value for today only)
          newRow[todayColumnIndex] = submittedItemData.quantity;
          
          if (oldValue && oldValue !== '') {
            console.log(`  ✏️  Updated ${itemObj.name}: ${oldValue} → ${submittedItemData.quantity}`);
            updatedCount++;
          } else {
            console.log(`  ➕ Added ${itemObj.name}: ${submittedItemData.quantity}`);
            newItemCount++;
          }
        } else if (existingRow && newRow[todayColumnIndex] && newRow[todayColumnIndex] !== '') {
          // Item not in submission but has existing value for today - preserve it
          console.log(`  ✅ Preserved ${itemObj.name}: ${newRow[todayColumnIndex]}`);
          preservedCount++;
        }
        // If item is not in newData, preserve existing value (already copied above from existingRow)

        finalData.push(newRow);
      });
    });

    console.log(`\n📊 Summary: ${newItemCount} new, ${updatedCount} updated, ${preservedCount} preserved`);
    console.log(`📏 Final data has ${finalData.length} rows (including header) and ${finalData[0].length} columns\n`);

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
    
    // Manage 15-day rolling data with data preservation
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

    console.log(`✅ Successfully updated Google Sheets for branch: ${branch} in ${config.sheetName}\n`);
    console.log(`${'='.repeat(80)}\n`);

    res.status(200).json({ 
      message: `Google Sheets updated successfully for ${branch}`,
      details: `Data maintained for last 15 days with dynamic date columns in ${config.sheetName} sheet. Multiple updates per day are allowed - previous data is preserved.`,
      updateDate: getTodayDateString()
    });
  } catch (err) {
    console.error('Error updating Google Sheets:', err);
    console.error('Error details:', err.message);
    console.error('Stack trace:', err.stack);
    res.status(500).json({ error: 'Failed to update Google Sheets: ' + err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});