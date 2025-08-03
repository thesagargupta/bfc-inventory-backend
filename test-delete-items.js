// Use built-in fetch (Node.js 18+) or install node-fetch@2
const fetch = globalThis.fetch || require('node-fetch');

const API_URL = 'http://localhost:5000/api/categories';

async function testDeleteItems() {
  try {
    console.log('Testing delete items functionality...');
    
    // First, create a test category with items
    const testCategory = {
      name: 'test-category',
      items: [
        { name: 'Test Item 1', unit: 'kg' },
        { name: 'Test Item 2', unit: 'gm' },
        { name: 'Test Item 3', unit: 'pc' }
      ]
    };
    
    console.log('1. Creating test category...');
    const createResponse = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testCategory)
    });
    
    if (!createResponse.ok) {
      throw new Error('Failed to create test category');
    }
    
    console.log('✅ Test category created');
    
    // Now test deleting specific items
    console.log('2. Deleting specific items...');
    const deleteResponse = await fetch(`${API_URL}/test-category/delete-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemsToDelete: ['Test Item 1', 'Test Item 3']
      })
    });
    
    if (!deleteResponse.ok) {
      const error = await deleteResponse.json();
      throw new Error(`Failed to delete items: ${error.error}`);
    }
    
    const deleteResult = await deleteResponse.json();
    console.log('✅ Items deleted successfully');
    console.log('Remaining items:', deleteResult.category.items.map(i => i.name));
    
    // Verify the result
    const getResponse = await fetch(API_URL);
    const categories = await getResponse.json();
    const testCat = categories.find(cat => cat.name === 'test-category');
    
    if (testCat && testCat.items.length === 1 && testCat.items[0].name === 'Test Item 2') {
      console.log('✅ Delete items functionality working correctly!');
    } else {
      console.log('❌ Delete items functionality not working as expected');
    }
    
    // Clean up - delete the test category
    console.log('3. Cleaning up test category...');
    await fetch(`${API_URL}/test-category`, { method: 'DELETE' });
    console.log('✅ Test category cleaned up');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testDeleteItems();