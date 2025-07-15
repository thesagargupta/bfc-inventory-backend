// Test script to verify Google Sheets integration
require('dotenv').config();
const { google } = require('googleapis');

const testGoogleSheets = async () => {
  try {
    console.log('Testing Google Sheets integration...');
    
    // Initialize Google Sheets API
    const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Test with Chandigarh sheet (you can change this to test other branches)
    const testSpreadsheetId = process.env.CHANDIGARH_SHEET_ID;
    
    if (!testSpreadsheetId) {
      console.error('❌ CHANDIGARH_SHEET_ID not found in environment variables');
      return;
    }
    
    // Test read operation
    console.log('Testing read operation...');
    const readResult = await sheets.spreadsheets.values.get({
      spreadsheetId: testSpreadsheetId,
      range: 'Sheet1!A1:E10',
    });
    
    console.log('✅ Successfully connected to Google Sheets!');
    console.log('Current data:', readResult.data.values || 'No data found');
    
    // Test write operation
    console.log('Testing write operation...');
    const testData = [
      ['Category', 'Item', 'Quantity (Kg)', 'Date', 'Branch'],
      ['Test Category', 'Test Item', '5', new Date().toISOString().split('T')[0], 'Chandigarh']
    ];
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: testSpreadsheetId,
      range: 'Sheet1!A1:E2',
      valueInputOption: 'RAW',
      requestBody: {
        values: testData
      }
    });
    
    console.log('✅ Successfully wrote test data to Google Sheets!');
    console.log('Test completed successfully! 🎉');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.code === 403) {
      console.error('This is likely a permissions issue. Make sure:');
      console.error('1. The service account has access to the spreadsheet');
      console.error('2. The spreadsheet is shared with the service account email');
    }
    
    if (error.code === 404) {
      console.error('Spreadsheet not found. Check your SHEET_ID in the .env file');
    }
  }
};

testGoogleSheets();