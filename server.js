const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

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

// Fixed items structure from frontend
const categoryMap = {
  Dairy: ["Milk", "Low Fat Butter", "CREAM", "Curd", "Greek Yogurt", "Paneer", "Tofu", "Custard Coolem", "Ice Cream Milk", "Ice cube"],
  Poultry: ["Eggs", "FISH", "Chicken Breast", "Chicken Keema", "Chicken Wings"],
  Bakery: ["Brown Bread Jumbo", "Pizza Base Wheat", "Burger Bun Wheat"],
  Grocery: [
    "Museli", "ajinomoto", "dates", "Aata", "Maida", "Bajra Aata", "Besan",
    "Baking Powder", "Brown Rice", "White Rice (Golden Sella Double Chabbi)", "Coffee", "Pineapple Slice Tin",
    "Tomato Puree", "DryYeist", "Quinua/ Foxtail / Kudos", "Couc Cous", "Red Beans", "White Kidney Beans",
    "Kabuli Chana", "Moong Whole (Sprouts)", "Chocolate Syrup", "Kevada Water", "Rose Water",
    "Mix Seeds (Sunflower, Pumpkin, Flex)", "Seasme Seeds", "Chia Seeds", "Hemp Seeds", "Jeerawan Powder",
    "Sugar", "Dhania Whole", "Mustard Seeds", "Peanuts Raw", "King Soya Oil", "Olive Oil", "Mustard Oil",
    "Peanut Butter", "Coco Powder", "Poha", "Oats", "Rolled Oats", "Moosli", "Honey", "Milkmaid",
    "Dark Compound", "Kismish", "Black Raisin", "Kaju", "Magaj", "Almonds", "Wallnuts", "Custard Powder",
    "Nachos", "Beetroot Chips", "Daliya", "HOT GARLIC SAUCE", "Haldiram Salted Peanuts", "Red Chilly Whole",
    "Coconut Milk Powder", "Coconut Powder", "Vanilla Frappe", "Vanilla Essence", "Parley Ji Buiscuit",
    "Black Olives", "Alipino", "Oregano", "Chilly Flakes", "Black Pepper", "Rock Salt", "Salt", "Haldi",
    "Kitchen King", "Degi Mirch", "Rajma Masala", "Jeera", "Maggi Masala", "Ghee", "Badi Elaichi",
    "Elachi Powder", "Staff Rice", "Staff Tea", "Phynile", "Pasta", "Clove", "Tej Patta", "Sooji",
    "Smokey Barbeque Masala", "Chat Masala", "Chicken Tikka Masala (Shan)", "Kebab Masala (Shan)",
    "Kasturi Methi", "Biryani Masala", "Peri Peri Masala", "Italian Mix Seasoning", "Garlic Powder",
    "Thai Curry Masala", "Caramel Syrup", "Cheese Cake Casata Syrup", "Tomato Ketchup", "TObasco", "Vinegar",
    "Soya Sauce", "Teriyaki Sauce", "Thai Sweet Chilly Sauce", "Kasundi Mustard", "English Mustard",
    "Barbeque Sauce", "Thousand Sauce", "Chilly Garlic Sauce", "Chipotle Sauce", "Sweet Onion Sauce",
    "Red Chilly Sauce", "Mayonese", "Strawberry Crush", "Blueberry Crush", "Hazelnut Syrup", "Cajun Powder",
    "Pineapple Juice Tetra", "Mix Berries Frozen", "BlueBerries Frozen", "Strawberry Frozen",
    "Soya Tikka Frozen (Vegley)", "Cheddar Cheese Slice", "Mozerella Cheese", "Cheese Block", "Pancake Mix",
    "Origano Mix Sachet", "Chilly Flakes Sachet", "sabudana", "Bhuna Chana", "Silver Foil", "soya chunks",
    "water"
  ],
  Fruit: [
    "Apple (Imp.)", "Banana", "Pomegranate", "Papaya", "Watermelon", "Dragon Fruit",
    "Kiwi (zespari)", "Grapes", "Red Globe", "Khajur (Kimia)", "Orange/Malta",
    "Sharda", "Guvava", "Pineapple", "Avacado", "Pears Indian"
  ],
  Vegetable: [
    "Aamla", "Curry Patta", "arbi", "Onion", "Tomato", "Potato", "Zuccini", "Brokli",
    "Carrot", "Beans", "Cucumber", "Mushroom", "Capsicum", "Lemon", "Mint", "Red Cabbage",
    "Ice Berg", "Cherry Tomato", "Garlic (Peeled)", "Ginger", "Pumpkin", "Celery", "Basil",
    "Sweet Corn (Frozen)", "Peas (Frozen)", "Sweet Potato", "Beetroot", "Cauliflower",
    "Cabbage", "Parseley", "Baby Corn", "Green Chilly", "Baby Spinach", "Spinach",
    "Bellpepper (Red,Yellow)", "Coriander", "Lettuce", "Spring Onion", "Kale"
  ],
  Packaging: [
    "750 ML Flat Round Paper Container", "500 ML Flat Round Paper Container", "350 ML Flat Round Paper Container",
    "100 ML Flat Round Paper Container", "Wooden Spork", "Sanitizer", "Tissue", "Straw Packed",
    "Glass Bottle 350 ML", "Glass Salsa Jar 350 ML", "Glass Salsa Jar 100 ML", "Carry Bag",
    "Burger Box", "Pizza Box 10\"", "Tape", "Sleeves", "ButterPaper", "Kot Roll"
  ],
  Mezza: [
    "Whole Wheat Pita", "beetroot roti", "beetroot wrap roti", "Spinach Patty", "Chop Masala",
    "ITALIAN GRAVY", "pizza sauce", "indian gravy", "Spinach Paste", "salsa sauce",
    "Hawaain Dressing", "chilly lime dressing", "Mint Sauce", "peanut sauce", "Truffles"
  ]
};

// Google Sheets configuration - Single spreadsheet with branch names as sheet names
const GOOGLE_SHEETS_CONFIG = {
  'Chandigarh': {
    spreadsheetId: process.env.DELHI_SHEET_ID,
    range: 'Chandigarh!A:I', // A:I to accommodate Category, Item, and 7 date columns
    sheetName: 'Chandigarh'
  },
  'Delhi': {
    spreadsheetId: process.env.DELHI_SHEET_ID,
    range: 'Delhi!A:I',
    sheetName: 'Delhi'
  },
  'Gurugram': {
    spreadsheetId: process.env.DELHI_SHEET_ID,
    range: 'Gurugram!A:I',
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

// Function to initialize sheet with fixed structure and dynamic date columns
const initializeSheetStructure = async (sheets, spreadsheetId, sheetName) => {
  try {
    // Prepare 7 date columns: today, yesterday, ..., 6 days ago
    const dateColumns = [];
    for (let i = 0; i < 7; i++) {
      dateColumns.push(getDateNDaysAgo(i));
    }

    // Create fixed structure with all items from all categories
    const fixedData = [
      ['Category', 'Item', ...dateColumns.map(date => `${date} (Kg)`)] // Headers with 7 date columns
    ];

    // Add all items from all categories
    Object.entries(categoryMap).forEach(([category, items]) => {
      items.forEach(item => {
        fixedData.push([category, item, ...Array(7).fill('')]); // Empty quantities for 7 columns initially
      });
    });

    const range = `${sheetName}!A:I`;
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

// Function to manage 7-day rolling data with dynamic date columns
const manageRollingData = async (sheets, spreadsheetId, sheetName, newData) => {
  try {
    const range = `${sheetName}!A:I`;
    
    // Get current data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: range
    });
    
    const currentData = response.data.values || [];
    if (currentData.length === 0) {
      // If no data, initialize with fixed structure
      await initializeSheetStructure(sheets, spreadsheetId, sheetName);
      return await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: range
      });
    }

    const headers = currentData[0];
    const dataRows = currentData.slice(1);
    
    // Prepare 7 date columns: today, yesterday, ..., 6 days ago
    const dateColumns = [];
    for (let i = 0; i < 7; i++) {
      dateColumns.push(getDateNDaysAgo(i));
    }

    // Create new headers with rolling 7-day date columns (today in C, then yesterday, ...)
    const newHeaders = ['Category', 'Item', ...dateColumns.map(date => `${date} (Kg)`)];
    
    // Extract existing date columns from current headers
    const existingDateColumns = headers.slice(2).map(header => {
      const dateMatch = header.match(/^(\d{4}-\d{2}-\d{2})/);
      return dateMatch ? dateMatch[1] : null;
    }).filter(date => date !== null);
    
    // Create data structure to hold item data with date columns
    const itemDataMap = new Map();
    
    // Initialize all items with empty values
    Object.entries(categoryMap).forEach(([category, items]) => {
      items.forEach(item => {
        const key = `${category}-${item}`;
        itemDataMap.set(key, {
          category,
          item,
          dates: new Map() // Map of date -> quantity
        });
      });
    });
    
    // Process existing data and map to date columns
    dataRows.forEach(row => {
      const [category, item, ...quantities] = row;
      if (category && item) {
        const key = `${category}-${item}`;
        const itemData = itemDataMap.get(key);
        
        if (itemData) {
          // Map existing quantities to their respective dates
          existingDateColumns.forEach((date, index) => {
            if (quantities[index] && date && dateColumns.includes(date)) {
              itemData.dates.set(date, quantities[index]);
            }
          });
        }
      }
    });
    
    // Add new data for today
    const today = getTodayDateString();
    Object.entries(newData).forEach(([item, itemData]) => {
      if (itemData.quantity) {
        const key = `${itemData.category}-${item}`;
        const mapData = itemDataMap.get(key);
        if (mapData) {
          mapData.dates.set(today, itemData.quantity);
        }
      }
    });
    
    // Build final data structure
    const finalData = [newHeaders];
    
    // Add data rows in fixed category order
    Object.entries(categoryMap).forEach(([category, items]) => {
      items.forEach(item => {
        const key = `${category}-${item}`;
        const itemData = itemDataMap.get(key);
        
        if (itemData) {
          const row = [category, item];
          
          // Add quantities for each date column
          dateColumns.forEach(date => {
            row.push(itemData.dates.get(date) || '');
          });
          
          finalData.push(row);
        }
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
