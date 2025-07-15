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

// Google Sheets configuration - Single spreadsheet with different sheets for each branch
const GOOGLE_SHEETS_CONFIG = {
  'Chandigarh': {
    spreadsheetId: process.env.DELHI_SHEET_ID, // Using Delhi sheet as main sheet
    range: 'Sheet1!A:E', // Chandigarh data goes to Sheet1
    sheetName: 'Sheet1'
  },
  'Delhi': {
    spreadsheetId: process.env.DELHI_SHEET_ID,
    range: 'Sheet2!A:E', // Delhi data goes to Sheet2
    sheetName: 'Sheet2'
  },
  'Gurugram': {
    spreadsheetId: process.env.DELHI_SHEET_ID, // Using Delhi sheet as main sheet
    range: 'Sheet3!A:E', // Gurugram data goes to Sheet3
    sheetName: 'Sheet3'
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

// Function to ensure required sheets exist
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
    } else {
      console.log(`Sheet ${sheetName} already exists`);
    }
  } catch (error) {
    console.error(`Error ensuring sheet ${sheetName} exists:`, error);
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
    
    // Clear existing data in the specific sheet (optional - remove if you want to append instead)
    await sheets.spreadsheets.values.clear({
      spreadsheetId: config.spreadsheetId,
      range: config.range,
    });

    // Prepare data for Google Sheets
    const values = [
      ['Category', 'Item', 'Quantity (Kg)', 'Date', 'Branch'], // Headers
      ...Object.entries(data)
        .filter(([, val]) => val.quantity)
        .map(([item, { quantity, category }]) => [
          category,
          item,
          quantity,
          getTodayDateString(),
          branch
        ])
    ];

    console.log(`Prepared values for Google Sheets:`, values);

    // Update the specific sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.spreadsheetId,
      range: config.range,
      valueInputOption: 'RAW',
      requestBody: {
        values: values
      }
    });

    console.log(`Successfully updated Google Sheets for branch: ${branch} in ${config.sheetName}`);

    // Save submission date for the branch
    const today = getTodayDateString();
    submissionTracker.set(branch, today);

    res.status(200).json({ message: `Google Sheets updated and submission recorded for ${branch} in ${config.sheetName}` });
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
