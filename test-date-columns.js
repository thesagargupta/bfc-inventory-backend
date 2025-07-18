// Test script to verify date column logic
const getTodayDateString = () => new Date().toISOString().split('T')[0];

const getDateNDaysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
};

// Test the date column generation
const today = getTodayDateString();
const yesterday = getDateNDaysAgo(1);
const dayBeforeYesterday = getDateNDaysAgo(2);

console.log('Date columns that will be created:');
console.log(`Column 1: ${dayBeforeYesterday} (Kg)`);
console.log(`Column 2: ${yesterday} (Kg)`);
console.log(`Column 3: ${today} (Kg)`);

// Test sample headers
const sampleHeaders = ['Category', 'Item', `${dayBeforeYesterday} (Kg)`, `${yesterday} (Kg)`, `${today} (Kg)`];
console.log('\nSample headers array:');
console.log(sampleHeaders);

// Test date extraction from headers
const dateColumns = sampleHeaders.slice(2).map(header => {
  const dateMatch = header.match(/^(\d{4}-\d{2}-\d{2})/);
  return dateMatch ? dateMatch[1] : null;
}).filter(date => date !== null);

console.log('\nExtracted dates from headers:');
console.log(dateColumns);

console.log('\nTest completed successfully!');