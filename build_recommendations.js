const fs = require('fs');
const path = require('path');

// Raw CSV content fetched from the latest Google Sheet
const csvContent = fs.readFileSync(path.join(__dirname, 'recommendations_latest.csv'), 'utf8');

const lines = csvContent.trim().split('\n');
const headers = lines[0].split(',');

// Map header names to indices
const headerMap = {};
headers.forEach((h, i) => headerMap[h.trim()] = i);

const products = [];

for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  const values = parseCSVLine(lines[i]);
  if (values.length < headers.length) continue;

  const product = {
    model: values[headerMap['Model Name']] || '',
    baseCode: values[headerMap['Base Code']] || '',
    image: values[headerMap['Key Visual Image']] || '',
    storage: values[headerMap['Storage']] || '',
    colorEn: values[headerMap['Color en_HK']] || '',
    colorZh: values[headerMap['color zh_HK']] || '',
    hexCode: values[headerMap['Hex Code']] || '',
    showInHKBuyPage: values[headerMap['showInHKBuyPage']] === 'TRUE',
    estoreExclusive: values[headerMap['Estore Exclusive']] === 'Y',
    sku: values[headerMap['SKU']] || '',
    rrp: parseInt(values[headerMap['RRP']]) || 0,
    lsvDiscount: parseInt(values[headerMap['LSV Discount']]) || 0,
    InStockStatus: values[headerMap['InStockStatus']] || 'Y',
    oosLink: values[headerMap['oosLink hk']] || '',
    oosLinkEn: values[headerMap['oosLink hk_en']] || '',
    gifts: [
      values[headerMap['Gift1']] || '',
      values[headerMap['Gift2']] || '',
      values[headerMap['Gift3']] || ''
    ].filter(g => g)
  };

  // Only include products that should be shown
  if (product.showInHKBuyPage) {
    products.push(product);
  }
}

fs.writeFileSync(
  path.join(__dirname, 'recommendations.json'),
  JSON.stringify({ products }, null, 2),
  'utf8'
);

console.log(`Generated recommendations.json with ${products.length} products`);

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