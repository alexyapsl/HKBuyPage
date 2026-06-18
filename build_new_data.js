const fs = require('fs');

// === 1. Build recommendations.json with baseCode ===
const recCsv = fs.readFileSync('recs_new.csv', 'utf8').trim();
const recLines = recCsv.split('\n');
const recProducts = [];
for (let i=1; i<recLines.length; i++) {
  if (!recLines[i].trim()) continue;
  const v = recLines[i].split(',');
  recProducts.push({
    model: v[0],
    baseCode: v[1],
    image: v[2],
    storage: v[3],
    colorEn: v[4],
    colorZh: v[5],
    showInHKBuyPage: v[6]==='TRUE',
    estoreExclusive: v[7]==='Y',
    sku: v[8],
    rrp: parseInt(v[9]),
    lsvDiscount: parseInt(v[10]),
    inStock: v[11]==='Y',
    buyLink: v[12],
    gifts: [v[14],v[15],v[16]].filter(g=>g&&g.trim())
  });
}
fs.writeFileSync('recommendations.json', JSON.stringify({products: recProducts}, null, 2), 'utf8');
console.log('recommendations.json written with', recProducts.length, 'rows');

// === 2. Build devices.json with new trade-in logic fields ===
const tiCsv = fs.readFileSync('tradein_new.csv', 'utf8').trim();
const tiLines = tiCsv.split('\n');
const tiDevices = [];
for (let i=1; i<tiLines.length; i++) {
  if (!tiLines[i].trim()) continue;
  const v = tiLines[i].split(',');
  tiDevices.push({
    brand: v[0],
    tradeInBaseCode: v[1],
    model: v[2],
    storage: v[3],
    recommendation1: v[4],
    recommendation2: v[5],
    standardPrice: parseInt(v[6].replace(/[^0-9]/g,'')),
    eti: {
      'SM-S9480': parseInt(v[7]) || 0,
      'SM-F9660': parseInt(v[8]) || 0,
      'SM-F7660': parseInt(v[9]) || 0
    },
    gti: {
      'SM-S9480': parseInt(v[10].replace(/[^0-9]/g,'')) || 0,
      'SM-F9660': parseInt(v[11].replace(/[^0-9]/g,'')) || 0,
      'SM-F7660': parseInt(v[12].replace(/[^0-9]/g,'')) || 0
    }
  });
}
fs.writeFileSync('devices.json', JSON.stringify(tiDevices, null, 2), 'utf8');
console.log('devices.json written with', tiDevices.length, 'rows');

console.log('Done.');