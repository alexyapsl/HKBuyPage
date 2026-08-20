// build_shanhs_models.js
// Walks ShanHS recycle API: category/list -> brand/list -> model/list
// Builds shanhs_models.json: [{ modelId, modelName (EN), brandId, brandName, categoryId, categoryName, gtiFlag, gtiSkus, restrictedSkus }]
// gtiFlag = true when the model has a non-empty gtiSkus list (eligible for GTI pricing / useGtiPrice on submit/order)
//
// Usage: node build_shanhs_models.js
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Load creds from .env.shanhs.local (SHANHS_APP_ID / SHANHS_APP_SECRET / SHANHS_UPSTREAM)
const envFile = path.join(__dirname, '.env.shanhs.local');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^(\w+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  });
}
const APP_ID = process.env.SHANHS_APP_ID || '57';
const secret = process.env.SHANHS_APP_SECRET || '';
const HOST = process.env.SHANHS_UPSTREAM || 'test.m.shanhs.com.cn';
const BASE = '/sapi/gateway/shanhs-global-recycle-api/samsung';
const OUT = path.join(__dirname, 'shanhs_models.json');

function post(apiPath, bizContent) {
  return new Promise((resolve) => {
    const timestamp = Date.now();
    const signInput = 'appId=' + APP_ID + '&bizContent=' + bizContent + '&timestamp=' + timestamp;
    const sign = crypto.createHmac('sha256', Buffer.from(secret, 'utf8')).update(signInput, 'utf8').digest('hex');
    const body = JSON.stringify({ appId: APP_ID, bizContent, timestamp, sign, signType: 'HS256' });
    const req = https.request({
      hostname: HOST, path: apiPath, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 30000
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ code: -1, message: 'bad json', raw: data }); }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ code: -1, message: 'timeout' }); });
    req.on('error', (e) => resolve({ code: -1, message: e.message }));
    req.write(body);
    req.end();
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Pick name for a language preference from a *NameList array
function pickName(nameList, langPrefs = [4, 5, 1]) {
  if (!Array.isArray(nameList) || !nameList.length) return '';
  for (const lang of langPrefs) {
    const hit = nameList.find(n => n.languageId === lang);
    if (hit && hit.modelName) return hit.modelName;
    if (hit && hit.categoryName) return hit.categoryName;
    if (hit && hit.brandName) return hit.brandName;
  }
  const first = nameList[0];
  return first.modelName || first.categoryName || first.brandName || '';
}

(async () => {
  // 1. Categories
  const catRes = await post(BASE + '/category/list', '{}');
  if (catRes.code !== 0) { console.error('category/list failed:', catRes); process.exit(1); }

  // data = array per language; take languageId 4 (EN) for the category set
  const catLang = (catRes.data || []).find(d => d.languageId === 4) || (catRes.data || [])[0];
  const categories = catLang.categoryList || [];
  console.log('Categories:', categories.map(c => c.categoryId + ':' + c.categoryName).join(' | '));

  const allModels = [];
  const seen = new Set();

  for (const cat of categories) {
    // 2. Brands per category
    const brandRes = await post(BASE + '/brand/list', JSON.stringify({ categoryId: cat.categoryId }));
    if (brandRes.code !== 0) { console.error('brand/list failed for cat', cat.categoryId, brandRes); continue; }
    const brandLang = (brandRes.data || []).find(d => d.languageId === 4) || (brandRes.data || [])[0];
    const brands = brandLang.brandList || [];
    console.log('cat ' + cat.categoryId + ' (' + cat.categoryName + '): ' + brands.length + ' brands');

    for (const brand of brands) {
      await sleep(150); // be polite
      // 3. Models per brand
      const modelRes = await post(BASE + '/model/list', JSON.stringify({ categoryId: cat.categoryId, brandId: brand.brandId }));
      if (modelRes.code !== 0) { console.error('  model/list failed for brand', brand.brandId, modelRes.message || ''); continue; }
      // model/list is NOT split by language; names inside modelNameList
      const models = (modelRes.data && modelRes.data.modelList) || [];
      for (const m of models) {
        if (seen.has(m.modelId)) continue;
        seen.add(m.modelId);
        const gtiSkus = Array.isArray(m.gtiSkus) ? m.gtiSkus : [];
        const restrictedSkus = Array.isArray(m.restrictedSkus) ? m.restrictedSkus : [];
        allModels.push({
          modelId: m.modelId,
          modelName: pickName(m.modelNameList, [4, 5, 1]),
          brandId: brand.brandId,
          brandName: brand.brandName,
          categoryId: cat.categoryId,
          categoryName: cat.categoryName,
          gtiFlag: gtiSkus.length > 0,
          gtiSkus,
          restrictedSkus
        });
      }
      if (models.length) console.log('  brand ' + brand.brandId + ' (' + brand.brandName + '): ' + models.length + ' models');
    }
  }

  allModels.sort((a, b) => a.categoryId - b.categoryId || a.brandId - b.brandId || a.modelId - b.modelId);

  const gtiCount = allModels.filter(m => m.gtiFlag).length;
  const out = {
    generatedAt: new Date().toISOString(),
    source: 'https://' + HOST + BASE,
    totalModels: allModels.length,
    gtiModelCount: gtiCount,
    models: allModels
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('');
  console.log('DONE: ' + allModels.length + ' models (' + gtiCount + ' with gtiFlag=true) -> ' + OUT);
})();
