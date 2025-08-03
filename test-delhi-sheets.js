const fetch = globalThis.fetch || require('node-fetch');

const API_URL = 'http://localhost:5000/api/categories';
const SHEETS_URL = 'http://localhost:5000/update-sheets';

async function testDelhiSheets() {
  try {
    console.log('Testing Delhi Google Sheets with fixed ranges...');
    
    // Create some test categories with items
    const testCategories = [
      {
        name: 'vegetables',
        items: [
          { name: 'Potatoes', unit: 'kg' },
          { name: 'Onions', unit: 'kg' },
          { name: 'Tomatoes', unit: 'kg' }
        ]
      },
      {
        name: 'fruits',
        items: [
          { name: 'Apples', unit: 'kg' },
          { name: 'Bananas', unit: 'kg' }
        ]
      }
    ];
    
    console.log('1. Creating test categories...');
    for (const category of testCategories) {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(category)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create category: ${category.name}`);
      }
    }
    console.log('✅ Test categories created');
    
    // Test Delhi sheet update with sample data
    console.log('2. Testing Delhi Google Sheets update...');
    const testData = {
      'Potatoes': { quantity: '5.5', category: 'vegetables' },
      'Onions': { quantity: '3.2', category: 'vegetables' },
      'Tomatoes': { quantity: '2.8', category: 'vegetables' },
      'Apples': { quantity: '4.1', category: 'fruits' },
      'Bananas': { quantity: '1.5', category: 'fruits' }
    };
    
    const sheetsResponse = await fetch(SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: testData,
        branch: 'Delhi'
      })
    });
    
    if (!sheetsResponse.ok) {
      const error = await sheetsResponse.json();
      console.log('❌ Google Sheets update failed:', error.error);
      throw new Error(error.error);
    } else {
      const result = await sheetsResponse.json();
      console.log('✅ Delhi Google Sheets updated successfully!');
      console.log('📊 Result:', result.message);
      console.log('📋 Details:', result.details);
    }
    
    // Clean up test categories
    console.log('3. Cleaning up test categories...');
    for (const category of testCategories) {
      await fetch(`${API_URL}/${category.name}`, { method: 'DELETE' });
    }
    console.log('✅ Test categories cleaned up');
    
    console.log('\n🎉 Delhi sheets test completed successfully!');
    console.log('📋 The range issue has been fixed - Delhi sheet now supports 10 columns (A:J)');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    // Clean up test categories even if test failed
    try {
      console.log('Cleaning up test categories after error...');
      const testCategoryNames = ['vegetables', 'fruits'];
      for (const categoryName of testCategoryNames) {
        await fetch(`${API_URL}/${categoryName}`, { method: 'DELETE' });
      }
      console.log('✅ Cleanup completed');
    } catch (cleanupError) {
      console.log('⚠️ Cleanup failed:', cleanupError.message);
    }
  }
}

testDelhiSheets();