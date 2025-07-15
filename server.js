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

// Google Sheets configuration for each branch
const GOOGLE_SHEETS_CONFIG = {
  'Chandigarh': {
    spreadsheetId: process.env.CHANDIGARH_SHEET_ID,
    range: 'Sheet1!A:E' // Category, Item, Quantity, Date, Branch
  },
  'Delhi': {
    spreadsheetId: process.env.DELHI_SHEET_ID,
    range: 'Sheet1!A:E'
  },
  'Gurugram': {
    spreadsheetId: process.env.GURUGRAM_SHEET_ID,
    range: 'Sheet1!A:E'
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
    const sheets = initializeGoogleSheets();
    const config = GOOGLE_SHEETS_CONFIG[branch];
    
    // Clear existing data (optional - remove if you want to append instead)
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

    // Update the sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.spreadsheetId,
      range: config.range,
      valueInputOption: 'RAW',
      requestBody: {
        values: values
      }
    });

    // Save submission date for the branch
    const today = getTodayDateString();
    submissionTracker.set(branch, today);

    res.status(200).json({ message: 'Google Sheets updated and submission recorded' });
  } catch (err) {
    console.error('Error updating Google Sheets:', err);
    res.status(500).json({ error: 'Failed to update Google Sheets' });
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
