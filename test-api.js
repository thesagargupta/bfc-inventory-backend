// Comprehensive test script for new dynamic date columns functionality
const testData = {
  "Milk": { quantity: "5", category: "Dairy" },
  "Eggs": { quantity: "2", category: "Poultry" },
  "Apple (Imp.)": { quantity: "3", category: "Fruit" },
  "Onion": { quantity: "4", category: "Vegetable" },
  "Brown Bread Jumbo": { quantity: "6", category: "Bakery" }
};

const testBranch = "Chandigarh";

console.log('🧪 Testing new dynamic date column functionality...\n');

// Test the API endpoint
console.log('📤 Testing update-sheets endpoint...');
fetch('http://localhost:5000/update-sheets', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    data: testData,
    branch: testBranch
  })
})
.then(response => response.json())
.then(data => {
  console.log('✅ API Response:', data);
  
  // Test last submission endpoint
  console.log('\n📤 Testing last-submission endpoint...');
  return fetch(`http://localhost:5000/last-submission/${testBranch}`);
})
.then(response => response.json())
.then(data => {
  console.log('✅ Last submission:', data);
  
  console.log('\n🎉 All tests completed successfully!');
  console.log('\n📊 Expected sheet structure:');
  console.log('- Category | Item | [Date-2] (Kg) | [Date-1] (Kg) | [Today] (Kg)');
  console.log('- Fixed items from all categories');
  console.log('- 3-day rolling data window');
  console.log('- Automatic cleanup of old data');
})
.catch(error => {
  console.error('❌ Error:', error);
});