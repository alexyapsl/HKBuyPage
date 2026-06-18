const fs = require('fs');
const path = require('path');

// Read the raw CSV (authoritative)
const csvPath = path.join(__dirname, 'recommendations_latest.csv');
const csvContent = fs.readFileSync(csvPath, 'utf8');

const lines = csvContent.trim().split('\n');
const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());

const headerMap = {};
headers.forEach((h, i) => { headerMap[h] = i; });

const modelMap = {}; // model name -> { name, image, storageOptions }

for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;

  const values = parseCSVLine(lines[i]);
  if (values.length < headers.length) continue;

  const show = (values[headerMap['showInHKBuyPage']] || '').replace(/"/g, '').trim().toUpperCase() === 'TRUE';
  if (!show) continue;

  const modelName = values[headerMap['Model Name']] || '';
  if (!modelName) continue;

  const image = values[headerMap['Key Visual Image']] || '';
  const storage = values[headerMap['Storage']] || '';
  const colorName = values[headerMap['Color en_HK']] || '';
  const sku = values[headerMap['SKU']] || '';

  if (!storage || !colorName || !sku) continue;

  // Initialize model entry if first time seen
  if (!modelMap[modelName]) {
    modelMap[modelName] = {
      name: modelName,
      image: image || '',
      storageOptions: []
    };
  } else if (!modelMap[modelName].image && image) {
    // Prefer the first image we encounter for this model
    modelMap[modelName].image = image;
  }

  // Find or create storage tier
  let storageTier = modelMap[modelName].storageOptions.find(s => s.storage === storage);
  if (!storageTier) {
    // We need the price from the sheet (use RRP)
    const price = parseInt(values[headerMap['RRP']]) || 0;
    storageTier = { storage, price, colors: [] };
    modelMap[modelName].storageOptions.push(storageTier);
  }

  // Add color if not already present
  const existingColor = storageTier.colors.find(c => c.sku === sku);
  if (!existingColor) {
    storageTier.colors.push({ name: colorName, sku });
  }
}

// Ensure storageOptions are sorted by storage size (nice-to-have)
Object.values(modelMap).forEach(m => {
  m.storageOptions.sort((a, b) => {
    const order = { '256GB+12GB': 1, '512GB+12GB': 2, '1TB+16GB': 3 };
    return (order[a.storage] || 99) - (order[b.storage] || 99);
  });
});

const step1models = Object.values(modelMap);

// Write the file
fs.writeFileSync(
  path.join(__dirname, 'step1models.json'),
  JSON.stringify(step1models, null, 2),
  'utf8'
);

console.log(`Generated step1models.json with ${step1models.length} models`);

// Simple CSV line parser that handles quotes
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}