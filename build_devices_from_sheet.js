const fs = require('fs');
const path = require('path');

// Raw CSV content from Google Sheet (fetched)
const csvContent = fs.readFileSync(path.join(__dirname, 'tradein_new.csv'), 'utf8');

const lines = csvContent.trim().split('\n');
const headers = lines[0].split(',');

// Find indices of key columns
const brandIdx = headers.indexOf('Brand');
const modelIdx = headers.indexOf('Model');
const storageIdx = headers.indexOf('Storage');
const stdPriceIdx = headers.indexOf('Standad Price'); // note the typo in header
const rec1Idx = headers.indexOf('Recommendation 1');
const rec2Idx = headers.indexOf('Recommendation 2');

// Find all ETI and GTI columns (they end with _ETI or _GTI)
const etiCols = headers.filter(h => h.endsWith('_ETI'));
const gtiCols = headers.filter(h => h.endsWith('_GTI'));

console.log(`Found ${etiCols.length} ETI columns and ${gtiCols.length} GTI columns`);

const devices = [];

for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  
  // Handle quoted fields properly (simple split won't work well with quotes)
  // For simplicity, we'll use a more robust parsing approach
  const values = parseCSVLine(lines[i], headers.length);
  
  if (values.length < headers.length) {
    console.warn('Skipping line ' + i + ': only ' + values.length + ' fields (expected ' + headers.length + ')');
    continue;
  }

  const brand = values[brandIdx];
  const model = values[modelIdx];
  const storage = values[storageIdx];
  const standardPriceStr = values[stdPriceIdx] || '0';
  const standardPrice = parseInt(standardPriceStr.replace(/[^0-9]/g, '')) || 0;

  const device = {
    brand,
    model,
    storage,
    recommendation1: values[rec1Idx] || '',
    recommendation2: values[rec2Idx] || '',
    standardPrice,
    eti: {},
    gti: {}
  };

  // Populate ETI values (keep even if empty — app falls back to standardPrice)
  etiCols.forEach(col => {
    const colIdx = headers.indexOf(col);
    const sku = col.replace('_ETI', '');
    const val = parseInt(values[colIdx]) || 0;
    device.eti[sku] = val;   // always write (0 or value)
  });

  // Populate GTI values (keep even if empty — app falls back to standardPrice)
  gtiCols.forEach(col => {
    const colIdx = headers.indexOf(col);
    const sku = col.replace('_GTI', '');
    const val = parseInt(values[colIdx]) || 0;
    device.gti[sku] = val;   // always write (0 or value)
  });

  devices.push(device);
}

fs.writeFileSync(
  path.join(__dirname, 'devices.json'),
  JSON.stringify(devices, null, 2),
  'utf8'
);

console.log(`Generated devices.json with ${devices.length} entries`);

// Helper to parse CSV line handling quotes + tolerant padding for missing trailing commas
function parseCSVLine(line, expectedLength) {
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

  // Pad with empty strings if line is short (handles missing trailing commas)
  while (result.length < expectedLength) {
    result.push('');
  }

  // If somehow longer, trim to expected
  if (result.length > expectedLength) {
    return result.slice(0, expectedLength);
  }

  return result;
}