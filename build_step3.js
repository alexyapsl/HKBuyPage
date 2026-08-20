// build_step3.js
// Builds step3models.json for the trade-in page Step 3 (Brand -> Model -> Storage)
// from the ShanHS recycle API model list + per-model /option trees.
//
// Input:  shanhs_models.json (from build_shanhs_models.js)
// Output: step3models.json
//   devices[]: { brand, brandId, categoryId, categoryName, modelId, model, gtiFlag, gtiSkus,
//                storageOptions[], channelOptions[], skuQuestions[], assessmentQuestions[] }
//
// Usage: node build_step3.js
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
const IN = path.join(__dirname, 'shanhs_models.json');
const OUT = path.join(__dirname, 'step3models.json');
const DELAY_MS = 120;

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
        catch { resolve({ code: -1, message: 'bad json' }); }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ code: -1, message: 'timeout' }); });
    req.on('error', (e) => resolve({ code: -1, message: e.message }));
    req.write(body);
    req.end();
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const enName = (list) => {
  if (!Array.isArray(list) || !list.length) return '';
  const en = list.find(n => n.languageId === 4);
  return (en || list[0]).optionName || '';
};

function mapQuestion(q) {
  return {
    detailId: q.detailId,
    name: enName(q.optionNameList),
    optionType: q.optionType,
    isMultiple: !!q.isMultiple,
    answers: (q.children || []).map(a => ({ detailId: a.detailId, name: enName(a.optionNameList) }))
  };
}

async function fetchOptions(modelId) {
  const r = await post(BASE + '/option', JSON.stringify({ modelId: String(modelId) }));
  if (r.code !== 0 || !r.data) return null;
  return r.data;
}

(async () => {
  const src = JSON.parse(fs.readFileSync(IN, 'utf8'));
  const models = src.models || [];
  console.log('Models to enrich:', models.length);

  const devices = [];
  const failed = [];

  for (let i = 0; i < models.length; i++) {
    const m = models[i];
    if (i % 50 === 0) {
      console.log('... ' + i + '/' + models.length);
      // checkpoint so a crash/restart doesn't lose everything
      fs.writeFileSync(OUT, JSON.stringify({ partial: true, generatedAt: new Date().toISOString(), totalDevices: devices.length, failedModelIds: failed, devices }, null, 2));
    }
    await sleep(DELAY_MS);

    let data = await fetchOptions(m.modelId);
    if (!data) { await sleep(500); data = await fetchOptions(m.modelId); } // one retry
    if (!data) { failed.push(m.modelId); continue; }

    const skuQuestions = (data.skuOptions || []).map(mapQuestion);
    const assessmentQuestions = (data.otherOptions || []).map(mapQuestion);

    // Convenience extracts
    const storageQ = skuQuestions.find(q => /storage|capacity|容量/i.test(q.name)) || skuQuestions[0];
    const channelQ = skuQuestions.find(q => /channel|purchase|購買/i.test(q.name));

    devices.push({
      brand: m.brandName,
      brandId: m.brandId,
      categoryId: m.categoryId,
      categoryName: m.categoryName,
      modelId: m.modelId,
      model: m.modelName,
      gtiFlag: m.gtiFlag,
      gtiSkus: m.gtiSkus,
      storageOptions: storageQ ? storageQ.answers : [],
      channelOptions: channelQ ? channelQ.answers : [],
      skuQuestions,
      assessmentQuestions
    });
  }

  const brands = [...new Set(devices.map(d => d.brand))].sort();
  const out = {
    generatedAt: new Date().toISOString(),
    source: 'ShanHS test env ' + BASE + ' (category/list + brand/list + model/list + option)',
    totalDevices: devices.length,
    failedModelIds: failed,
    brands,
    devices
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('DONE: ' + devices.length + ' devices -> ' + OUT);
  if (failed.length) console.log('FAILED modelIds (' + failed.length + '):', failed.join(','));
  const noStorage = devices.filter(d => !d.storageOptions.length);
  if (noStorage.length) console.log('Devices with NO storage options:', noStorage.length, '(' + noStorage.slice(0, 5).map(d => d.model).join(' | ') + '...)');
})();
