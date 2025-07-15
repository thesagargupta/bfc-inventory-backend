# Single Google Sheet Integration - Changes Summary

## What Changed

The system has been updated to use a **single Google Sheet** with multiple tabs instead of separate Google Sheets for each branch.

## New Data Structure

- **Single Google Sheet**: Use your Delhi Google Sheet as the main spreadsheet
- **Branch Data Distribution**:
  - **Sheet1**: Chandigarh branch data
  - **Sheet2**: Delhi branch data
  - **Sheet3**: Gurugram branch data

## Changes Made

### 1. Backend Configuration (`server.js`)
- Modified `GOOGLE_SHEETS_CONFIG` to use single spreadsheet ID (Delhi sheet)
- Added `sheetName` property to identify which tab to use for each branch
- All branches now use `process.env.DELHI_SHEET_ID` as the spreadsheet ID

### 2. Sheet Auto-Creation
- Added `ensureSheetExists()` function to automatically create required sheets
- System will create Sheet1, Sheet2, and Sheet3 if they don't exist
- No manual sheet creation needed

### 3. Updated Documentation
- Modified `GOOGLE_SHEETS_SETUP.md` to reflect new single-sheet setup
- Updated environment variable requirements
- Added clear instructions for the new structure

### 4. Test File (`test-sheets.js`)
- Updated to test single spreadsheet with multiple tabs
- Tests creation of all three sheets
- Verifies data writing to each branch's designated sheet

## Environment Variables Needed

You only need **ONE** environment variable now:
```
DELHI_SHEET_ID=your_delhi_sheet_id
```

## How It Works

1. **Data Submission**: When a branch submits data, it goes to the main spreadsheet
2. **Sheet Selection**: Based on the branch:
   - Chandigarh → Sheet1
   - Delhi → Sheet2
   - Gurugram → Sheet3
3. **Auto-Creation**: If a sheet doesn't exist, it's created automatically
4. **Data Isolation**: Each branch's data is kept in its own sheet tab

## Benefits

- **Centralized Data**: All branch data in one place
- **Easy Management**: Single spreadsheet to manage and share
- **Clear Organization**: Each branch has its own tab
- **No Duplication**: One set of credentials, one spreadsheet to maintain

## Migration Steps

1. Use your existing Delhi Google Sheet as the main sheet
2. Update your `.env` file to only include `DELHI_SHEET_ID`
3. Remove `CHANDIGARH_SHEET_ID` and `GURUGRAM_SHEET_ID` from `.env`
4. Restart your backend server
5. Test with different branches - sheets will be created automatically

## Testing

Run the test script to verify everything works:
```bash
node test-sheets.js
```

This will create the three sheets and test data writing to each one.