// Test script to verify Google Sheets integration with single spreadsheet
require('dotenv').config();
const { google } = require('googleapis');

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
    const spreadsheetInfo = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId
    });

    const existingSheets = spreadsheetInfo.data.sheets.map(sheet => sheet.properties.title);
    
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
      console.log(`✓ Sheet ${sheetName} created successfully`);
    } else {
      console.log(`✓ Sheet ${sheetName} already exists`);
    }
  } catch (error) {
    console.error(`Error ensuring sheet ${sheetName} exists:`, error);
    throw error;
  }
};

async function testGoogleSheetsConnection() {
  try {
    const sheets = initializeGoogleSheets();
    
    // Test single spreadsheet with multiple sheets
    const mainSpreadsheetId = process.env.DELHI_SHEET_ID;
    console.log(`Testing main spreadsheet with ID: ${mainSpreadsheetId}`);
    
    if (!mainSpreadsheetId) {
      console.error('❌ DELHI_SHEET_ID not found in environment variables');
      return;
    }
    
    const response = await sheets.spreadsheets.get({
      spreadsheetId: mainSpreadsheetId
    });
    
    console.log(`✓ Main spreadsheet found: ${response.data.properties.title}`);
    
    // Test creating sheets for each branch
    const branchSheets = [
      { branch: 'Chandigarh', sheetName: 'Sheet1' },
      { branch: 'Delhi', sheetName: 'Sheet2' },
      { branch: 'Gurugram', sheetName: 'Sheet3' }
    ];
    
    for (const { branch, sheetName } of branchSheets) {
      console.log(`\nTesting ${branch} (${sheetName})...`);
      
      // Ensure sheet exists
      await ensureSheetExists(sheets, mainSpreadsheetId, sheetName);
      
      // Test writing sample data
      const testData = [
        ['Category', 'Item', 'Quantity (Kg)', 'Date', 'Branch'],
        ['Test Category', 'Test Item', '5', new Date().toISOString().split('T')[0], branch]
      ];
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: mainSpreadsheetId,
        range: `${sheetName}!A1:E2`,
        valueInputOption: 'RAW',
        requestBody: {
          values: testData
        }
      });
      
      console.log(`✓ Test data written to ${branch} in ${sheetName}`);
    }
    
    console.log('\n✅ All tests passed! Single Google Sheet with multiple tabs is working correctly.');
    console.log('Data structure:');
    console.log('- Sheet1: Chandigarh branch data');
    console.log('- Sheet2: Delhi branch data');
    console.log('- Sheet3: Gurugram branch data');
    
  } catch (error) {
    console.error('❌ Error testing Google Sheets connection:', error.message);
    
    if (error.code === 403) {
      console.error('This is likely a permissions issue. Make sure:');
      console.error('1. The service account has access to the spreadsheet');
      console.error('2. The spreadsheet is shared with the service account email');
    }
    
    if (error.code === 404) {
      console.error('Spreadsheet not found. Check your DELHI_SHEET_ID in the .env file');
    }
  }
}

testGoogleSheetsConnection();