// Trade-in chain console test — paste into DevTools console on https://www.samsung.com
// Dry-run by default: runs the full assessment but does NOT add to cart.
// Set DO_ADDTOCART = true to perform the real addToCart POST.
// ====== CONFIG (edit me) ======
const DO_ADDTOCART = false;          // true = actually add device + trade-in to cart
const LANG = 'hk';                   // 'hk' (zh) or 'hk_en'
const TARGET_SKU = 'SM-S9480ZSPTGY'; // new device being bought
const IMEI = '543215432154321';      // trade-in device IMEI
const DEVICE = {                     // trade-in device identity (from ShanHS data / page)
  brandId: 20,                       // Samsung = 20 (usually)
  categoryId: 1,                     // 1 phones/tablets, 3 notebooks (NOT supported), 5 watches
  modelId: 17081,                    // ShanHS modelId; page rows expose via flattenShanhsDevices
  storageDetailId: 1157,             // capacity detailId (phones/tablets only)
  channelDetailId: 1920,             // purchase channel detailId (usually 1920)
};
// ====== CHAIN (same code as index-aem-preorder-final.html) ======
function tiJsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = 'tiJsonpCb' + Date.now() + Math.floor(Math.random() * 1000);
    const script = document.createElement('script');
    const timer = setTimeout(() => { cleanup(); reject(new Error('IMEI validation timed out')); }, 12000);
    const cleanup = () => { clearTimeout(timer); try { delete window[cb]; } catch (_) { window[cb] = undefined; } script.remove(); };
    window[cb] = (data) => { cleanup(); resolve(data); };
    script.onerror = () => { cleanup(); reject(new Error('IMEI validation request failed')); };
    script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + cb;
    document.head.appendChild(script);
  });
}
async function tiValidateImei(device, imei) {
  const url = `https://shop.samsung.com/${LANG}/servicesv2/validateImeiWithoutProduct?provider=SHS&brandId=${device.brandId}&code=${encodeURIComponent(imei)}&supportType=1&modelId=${device.modelId}`;
  const data = await tiJsonp(url);
  if (data && data.resultCode === '0000') return { ok: true };
  return { ok: false, message: (data && data.resultMessage) || 'IMEI validation failed' };
}
const tiAiVal = (node, k) => { const f = ((node && node.additionalInfos) || []).find(i => i.key === k); return f ? String(f.value) : ''; };
async function tiFilterDevices(key, targetSku) {
  const res = await fetch(`https://api.shop.samsung.com/tokocommercewebservices/v2/${LANG}/tradeIn/services/filterDevices?key=${enco…ey)}&provider=SHS&mainProductCode=${encodeURIComponent(targetSku)}`, { credentials: 'include', headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error('Trade-in catalog request failed (' + res.status + ')');
  return res.json();
}
async function tiBuildSelectionResponses(device, targetSku) {
  const categoryId = String(device.categoryId || '1');
  if (categoryId === '3') throw new Error('Notebooks not supported by this flow');
  const levels = [];
  const dt = (await tiFilterDevices('', targetSku)).find(n => tiAiVal(n, 'deviceType') === categoryId);
  levels.push(dt);
  const brand = (await tiFilterDevices(dt.key, targetSku)).find(n => tiAiVal(n, 'brand') === String(device.brandId));
  levels.push(brand);
  const model = (await tiFilterDevices(brand.key, targetSku)).find(n => tiAiVal(n, 'model') === String(device.modelId));
  if (!model) throw new Error('Trade-in model not found in Samsung catalog');
  levels.push(model);
  if (categoryId === '1') {
    const cap = (await tiFilterDevices(model.key, targetSku)).find(n => tiAiVal(n, 'capacity') === String(device.storageDetailId));
    if (!cap) throw new Error('Trade-in capacity not found in Samsung catalog');
    levels.push(cap);
  }
  const chans = await tiFilterDevices(levels[levels.length - 1].key, targetSku);
  const chan = chans.find(n => tiAiVal(n, 'purchaseChannel') === String(device.channelDetailId || '1920')) || chans[0];
  levels.push(chan);
  const baseProduct = targetSku.split('-').slice(0, 2).join('-');
  levels.forEach(n => { n.mainBaseProductCode = baseProduct; });
  for (let i = 1; i < levels.length; i++) {
    levels[i].parent = { key: null, name: levels[i - 1].name, value: levels[i - 1].value, code: null, parent: null, mainProductCode: null, additionalInfos: null, imeiCheckInfo: null, imeiCheckOptions: null, priceMap: null, additionalDiscountApplied: false, isChildPresent: false, identifier: null, identifierName: null, provider: null, hideFlag: false, mainBaseProductCode: null, baseProductPriorityMap: null, campaignBonuses: null, offeredPriceMap: null };
  }
  levels[levels.length - 1].maxTradeIn = '';
  return levels;
}
async function tiSubmitAssessment(device, imei, targetSku) {
  const check = await tiValidateImei(device, imei);
  if (!check.ok) throw new Error(check.message);
  console.log('[ti] 1. IMEI valid');
  const init = await fetch(`https://shop.samsung.com/${LANG}/servicesv2/getTradeInSimpleInfo?productCode=${encodeURIComponent(targetSku)}`, { credentials: 'include' });
  if (!init.ok) throw new Error('Trade-in init failed (' + init.status + ')');
  console.log('[ti] 2. trade-in init ok');
  const [csrfToken, questions, selectionResponses] = await Promise.all([
    fetch(`https://shop.samsung.com/${LANG}/security/csrf`, { credentials: 'include' }).then(r => r.json()).then(d => d.token),
    fetch(`https://api.shop.samsung.com/tokocommercewebservices/v2/${LANG}/servicesv2/assessment/TRADE_IN?q=${encodeURIComponent(device.modelId)}&provider=SHS`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imei: '' }) }).then(r => r.json()).then(d => d.questions || []),
    tiBuildSelectionResponses(device, targetSku),
  ]);
  console.log('[ti] 3. csrf + questionnaire (' + questions.length + ' questions) + selection walk ok');
  const responses = questions.filter(q => q.answers && q.answers.length > 0).map(q => ({ name: q.questionId, value: q.answers[0].value }));
  responses.push({ name: 'voucherCode' });
  responses.push({ name: 'purchaseFrom', value: '0' });
  const body = { imei, orderEntryNumber: 0, productCode: '1', responses, targetProductCode: targetSku, selectionResponses };
  const res = await fetch(`https://shop.samsung.com/${LANG}/assessment/TRADE_IN/json?CSRFToken=${encodeURIComponent(csrfToken)}&provider=SHS`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error('Trade-in assessment failed (' + res.status + ')');
  const data = await res.json();
  const infos = (data.result && data.result.additionalInfos) || [];
  const get = k => { const f = infos.find(i => i.key === k); return f ? f.value : undefined; };
  const errVal = get('ERROR');
  if (errVal) throw new Error(errVal);
  if (get('resultCode') !== '100' || !get('tradeInIdentifier')) throw new Error('Assessment not accepted');
  console.log('[ti] 4. assessment accepted: discountAmount', get('discountAmount'), '| gtiPrice', get('gtiPrice'), '| tickPrice', get('tickPrice'));
  const serviceInfos = [{ key: 'IMEI', value: imei }];
  infos.forEach(i => serviceInfos.push({ key: i.key, value: i.value }));
  const gti = parseFloat(get('gtiPrice') || '0');
  serviceInfos.push({ key: 'usedPrice', value: gti > 0 ? 'gtiPrice,tickPrice' : 'tickPrice' });
  return [{ serviceCode: 'T-SHS-TRADEIN', additionalInfos: serviceInfos }];
}
// ====== RUN ======
(async () => {
  try {
    console.log('[ti] START — sku:', TARGET_SKU, '| imei:', IMEI, '| dry run:', !DO_ADDTOCART);
    const services = await tiSubmitAssessment(DEVICE, IMEI, TARGET_SKU);
    console.log('[ti] services payload (' + services[0].additionalInfos.length + ' infos):', services);
    if (!DO_ADDTOCART) { console.log('[ti] DRY RUN done — set DO_ADDTOCART = true to add to cart'); return; }
    const cartRes = await fetch(`https://api.shop.samsung.com/tokocommercewebservices/v2/${LANG}/addToCart/multi/?fields=BASIC`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ productCode: TARGET_SKU, qty: 1, services }]) });
    const cartData = await cartRes.json();
    console.log('[ti] addToCart:', cartRes.status, cartData);
    console.log('[ti] DONE — check your cart (badge should show +1, trade-in attached to the entry)');
  } catch (e) {
    console.error('[ti] FAILED:', e.message || e);
  }
})();
