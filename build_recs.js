const fs = require('fs');
const csv = fs.readFileSync('recs.csv', 'utf8').trim();
const lines = csv.split('\n');
const products = [];
for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  const vals = lines[i].split(',');
  products.push({
    model: vals[0],
    image: vals[1],
    storage: vals[2],
    colorEn: vals[3],
    colorZh: vals[4],
    showInHKBuyPage: vals[5] === 'TRUE',
    estoreExclusive: vals[6] === 'Y',
    sku: vals[7],
    rrp: parseInt(vals[8]),
    lsvDiscount: parseInt(vals[9]),
    inStock: vals[10] === 'Y',
    buyLink: vals[11],
    gifts: [vals[13], vals[14], vals[15]].filter(g => g && g.trim())
  });
}
fs.writeFileSync('recommendations.json', JSON.stringify({ products }, null, 2), 'utf8');
console.log('Created recommendations.json with', products.length, 'variants');