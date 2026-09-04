// build_step3_slim.js
// Slims step3models.json (3.5MB, full question trees) down to step3models_slim.json
// containing only what the page's Step 3 flow needs:
//   brand/model selection, storage options, HK channel detailId, best-condition answer IDs
// Usage: node build_step3_slim.js
const fs = require('fs');
const path = require('path');

const IN = path.join(__dirname, 'step3models.json');
const OUT = path.join(__dirname, 'step3models_slim.json');

const src = JSON.parse(fs.readFileSync(IN, 'utf8'));

const devices = (src.devices || []).map(d => {
  // default channel = Hong Kong/Macau (first channel option)
  const channel = (d.channelOptions && d.channelOptions[0]) || null;
  // best condition = first answer of each assessment question (lowest sort = best)
  const bestIds = (d.assessmentQuestions || [])
    .map(q => (q.answers && q.answers[0]) ? q.answers[0].detailId : null)
    .filter(Boolean);
  return {
    brand: d.brand,
    brandId: d.brandId,
    categoryId: d.categoryId,
    modelId: d.modelId,
    model: d.model,
    gtiFlag: d.gtiFlag,
    storages: (d.storageOptions || []).map(o => ({ detailId: o.detailId, name: o.name })),
    channelDetailId: channel ? channel.detailId : null,
    bestIds
  };
}).filter(d => d.storages.length > 0);

const out = {
  generatedAt: new Date().toISOString(),
  note: 'Slim Step-3 dataset. detailIds for price-cal = [storageDetailId, channelDetailId, ...bestIds]',
  totalDevices: devices.length,
  // Brand order = ShanHS API order (sort field): SAMSUNG first, not alphabetical.
  // devices[] is already in ShanHS order (build_shanhs_models.js preserves raw API order),
  // so first-appearance order here matches the brand/list sort.
  brands: [...new Set(devices.map(d => d.brand))],
  devices
};
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('DONE:', devices.length, 'devices,', Math.round(fs.statSync(OUT).size / 1024) + 'KB ->', OUT);
