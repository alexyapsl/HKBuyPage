const fs = require('fs');
const path = require('path');

// Use the latest CSV (recommendation columns removed)
const csvContent = fs.readFileSync(path.join(__dirname, 'tradein_new.csv'), 'utf8');

const lines = csvContent.trim().split('\n');
const headers = parseCSVLine(lines[0], 100);

// Find indices of key columns
const brandIdx = headers.indexOf('Brand');
const modelIdx = headers.indexOf('Model');
const storageIdx = headers.indexOf('Storage');
const stdPriceIdx = headers.indexOf('Standad Price');

// Dynamically find all ETI and GTI columns
const etiCols = headers.filter(h => h.endsWith('_ETI'));
const gtiCols = headers.filter(h => h.endsWith('_GTI'));

console.log(`Found ${etiCols.length} ETI columns and ${gtiCols.length} GTI columns`);

const devices = [];

for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;

  const values = parseCSVLine(lines[i], headers.length);

  if (values.length !== headers.length) {
    console.warn('Skipping line ' + i + ': field count mismatch (' + values.length + ' vs ' + headers.length + ')');
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
    recommendation1: values[headers.indexOf('Recommendation 1')] || '',
    recommendation2: values[headers.indexOf('Recommendation 2')] || '',
    standardPrice,
    eti: {},
    gti: {}
  };

  // ETI — skip N/A and empty
  etiCols.forEach(col => {
    const colIdx = headers.indexOf(col);
    const sku = col.replace('_ETI', '');
    const raw = (values[colIdx] || '').trim().toUpperCase();
    if (raw === 'N/A' || raw === 'NA' || raw === '') return;
    const val = parseInt(values[colIdx]);
    if (!isNaN(val)) device.eti[sku] = val;
  });

  // GTI — skip N/A and empty
  gtiCols.forEach(col => {
    const colIdx = headers.indexOf(col);
    const sku = col.replace('_GTI', '');
    const raw = (values[colIdx] || '').trim().toUpperCase();
    if (raw === 'N/A' || raw === 'NA' || raw === '') return;
    const val = parseInt(values[colIdx]);
    if (!isNaN(val)) device.gti[sku] = val;
  });

  devices.push(device);
}

fs.writeFileSync(
  path.join(__dirname, 'devices.json'),
  JSON.stringify(devices, null, 2),
  'utf8'
);

console.log(`Generated devices.json with ${devices.length} entries`);

// Correct RFC-4180 CSV parser that properly handles quoted fields
function parseCSVLine(line, expectedLength) {
  const result = [];
  let i = 0;
  const len = line.length;

  while (i < len) {
    let field = '';
    let inQuotes = false;

    if (line[i] === '"') {
      inQuotes = true;
      i++;
    }

    while (i < len) {
      const ch = line[i];

      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < len && line[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i++;
          // consume the closing quote and continue to next field
          if (i < len && line[i] === ',') i++;
          break;
        }
        field += ch;
        i++;
      } else {
        if (ch === ',') {
          i++;
          break;
        }
        field += ch;
        i++;
      }
    }

    result.push(field.trim());
  }

  while (result.length < expectedLength) result.push('');
  if (result.length > expectedLength) return result.slice(0, expectedLength);
  return result;
}
