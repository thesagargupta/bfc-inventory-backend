# Google Sheets Integration Setup Guide

## 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Sheets API:
   - Go to APIs & Services > Library
   - Search for "Google Sheets API"
   - Click on it and press "Enable"

## 2. Create Service Account

1. Go to APIs & Services > Credentials
2. Click "Create Credentials" > "Service Account"
3. Fill in the service account details and click "Create" 
4. Skip the optional steps and click "Done"

## 3. Generate Service Account Key

1. In the Credentials page, find your service account
2. Click on the service account email
3. Go to the "Keys" tab
4. Click "Add Key" > "Create new key"
5. Choose "JSON" format and click "Create"
6. Download the JSON file - this contains your credentials

## 4. Setup Environment Variables

1. Copy the content of the downloaded JSON file
2. In your `.env` file, set `GOOGLE_SHEETS_CREDENTIALS` to the JSON content (as a single line string)

## 5. Create Single Google Sheet

1. Create ONE Google Sheet (use your Delhi sheet as the main sheet)
2. Copy the Sheet ID from the URL (the long string between `/d/` and `/edit`)
3. Add the Sheet ID to your `.env` file:
   ```
   DELHI_SHEET_ID=your_delhi_sheet_id
   ```

**Note:** The system will automatically create three sheets/tabs within this single spreadsheet:
- **Sheet1**: For Chandigarh branch data
- **Sheet2**: For Delhi branch data  
- **Sheet3**: For Gurugram branch data

## 6. Share Sheet with Service Account

1. For the Google Sheet, click "Share"
2. Add the service account email (from the JSON file) as an Editor
3. The service account email looks like: `your-service-account@your-project-id.iam.gserviceaccount.com`

## 7. Sheet Structure

Each sheet/tab will have the following columns:
- Column A: Category
- Column B: Item
- Column C: Quantity (Kg)
- Column D: Date
- Column E: Branch

The system will automatically:
- Create the required sheets (Sheet1, Sheet2, Sheet3) if they don't exist
- Add headers and data to these columns
- Route each branch's data to its designated sheet

## 8. Install Dependencies

Run the following command in your backend directory:
```bash
npm install googleapis
```

## 9. Test the Setup

1. Start your backend server
2. Try submitting data through the frontend for different branches
3. Check if the data appears in the corresponding sheets within the single Google Sheet:
   - Chandigarh data → Sheet1
   - Delhi data → Sheet2
   - Gurugram data → Sheet3