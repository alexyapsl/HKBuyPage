# ShanHS API — Verified Live Findings (test env)

Probed live against `https://test.m.shanhs.com.cn` on 2026-08-10 by Bapo.
All calls use the standard envelope: `{appId:"57", bizContent:<string>, timestamp:<ms>, sign:<hmac>, signType:"HS256"}`.

## Signing (verified working)
- signInput = `appId=57&bizContent=<raw JSON string>&timestamp=<epoch ms>` — raw, no URL-encoding, exact key order
- HMAC-SHA256, key = appSecret, lowercase hex output
- sign + signType added to envelope AFTER signing (not part of signed string)
- Secret from IMPEX (`toko.shs.app.secret.hk`) is valid on test env — plain hex HMAC accepted, **no extra encryption layer** (confirmed live 2026-08-10)
- If sending form-encoded on the wire, URL-encode values but sign the RAW string

## Endpoint map (`/sapi/gateway/shanhs-global-recycle-api/samsung/...`)

| # | Endpoint | bizContent | Response notes |
|---|----------|-----------|----------------|
| 1 | `/category/list` | `{}` | code:0. data = array by languageId (4=en,5=zh), each with categoryList[{categoryId, categoryName, sort}]. Categories: 1 Smartphone & Tablet, 3 Notebook, 5 Smartwatch |
| 2 | `/brand/list` | `{"categoryId":1}` (required) | code:0. brandList[{brandId, brandName, brandImg, sort, categoryId}] per language. SAMSUNG=20, APPLE=10, ... |
| 3 | `/model/list` | `{"categoryId":1,"brandId":10}` (both required) | code:0. modelList[{modelId, modelImg, sort, modelNameList[{modelName,languageId}], gtiSkus, restrictedSkus}] — NOT split by language; names inside modelNameList. e.g. 13202 = Apple iPhone 16 Pro |
| 4 | `/option` | `{"modelId":"13202"}` | code:0. data{categoryId, brandId, skuOptions[], otherOptions[]}. Each option = QUESTION with children[] ANSWERs: {detailId, parentDetailId, optionType(SKU/NORMAL), optionLevel, sort, isMultiple, optionNameList[{languageId, optionName}]} |
| 5 | `/price-cal` | see below | code:0. data{price, ticketPrice, calUUId, hasFixPrice} |
| 6 | `/verify/imei` | `{"modelId":"13202","imei":"...","isNewDevice":"false"}` | code:0. data{hasRecycle:bool, status:"Y"} |
| 7 | `/submit/order` | bizContent = JSON **array** of SamsungOrder (schema below) | spec extracted from Apifox |
| 8 | `/modify/imei` | `{}` returned code:0 on test (stub?) | response shape likely SubmitImeiResultDto; request spec needs ShanHS confirmation |

## price-cal required fields (discovered via validation walk)
```json
{
  "memberLevel": 3,
  "modelId": "13202",
  "detailIds": [1150, 1920, 400011, 400021, 400031, 400051],
  "recyclePhoneImei": "828446074007286",
  "newPhoneModelCode": "VCEN4P4YAK",
  "newSkuList": []
}
```
- `modelId` — NOT `modelCode` (the early snippet with `{"memberLevel":3,"modelCode":"VCEN4P4YAK","newSkuList":[]}` is rejected: "modelId is not null")
- `detailIds` — one selected ANSWER detailId per question from /option
- `recyclePhoneImei` — required even for price query
- `newPhoneModelCode` — the NEW device being purchased (e.g. VCEN4P4YAK)
- Live verified response: `{"price":2185,"ticketPrice":666.00,"calUUId":"...","hasFixPrice":false}` (iPhone 16 Pro, best-condition answers, memberLevel 3)
- `calUUId` presumably feeds submit/order

## Error codes seen
- 10020 — Authentication_failed, sign error
- 10023 — DATA_VALIDATION_FAILED (message names the missing field)
- 10025 — Internal_System_Error (also used for bizContent wrong type, e.g. object vs array on submit/order)

## Design implications for the trade-in page
1. Nightly sync covers APIs 1–4 (category → brand → model → option tree). All verified working.
2. Live price ping needs: model + ALL assessment answers + IMEI + new-phone model code → fires at END of assessment flow, not at dropdown selection.
3. Verify-IMEI can run as a separate live check before price-cal.
4. submit/order + modify/imei field specs should be taken from the Apifox doc (https://s.apifox.cn/7cc55cb0-85ba-4b33-813d-efa57b7c1f8b/7522710m0, pw in integration doc) — test env returns code:0 for anything array-shaped, so it can't be reverse-engineered reliably.

## submit/order — SamsungOrder schema (from Apifox data-schemas, 2026-08-10)
bizContent = JSON **array** of SamsungOrder objects:

| field | type | required | notes |
|-------|------|----------|-------|
| imei | string | ✅ | old phone IMEI |
| modelId | integer | ✅ | recycle model id |
| name | string | ✅ | customer name |
| mobile | string | ✅ | format `{areacode},{phonenumber}` e.g. `86,17372817707` |
| email | string | ✅ | |
| thirdOrderCode | string | ✅ | Samsung order code |
| languageId | integer | ✅ | 1=CN, 4=EN, 5=HK |
| newPhoneModelCode | string | ✅ | new phone SKU |
| calUUId | string | ✅ | from price-cal response |
| brandId | integer | ⬜ | |
| useTicketPrice | boolean | ⬜ | use rebate amount |
| useGtiPrice | boolean | ⬜ | use GTI price |

## modify/imei
No dedicated request schema found in the shared doc (likely inline). `SubmitImeiResultDto` exists as a response shape: `{hasMiCare:boolean, newPrice:number}`. Confirm exact request fields with ShanHS.

## About the "encryption" claim
The doc DOES contain `EncryptedRequest`/`EncryptedResponse` schemas — but they are base64 envelope wrappers (`{"encryptedRequestBase64":"..."}`) sitting next to the **HSBC notice** schemas (`HsbcNoticeRequest/Response`). They belong to a different API family, NOT the Samsung recycle APIs. All 8 ShanHS Samsung endpoints take plain signed JSON — verified live.

## Other useful schemas
- `QueryPriceRequest` (internal): templateGroupCode, channelId, modelId, optionIds[] required — matches what price-cal resolves to server-side
- `CalPriceVO`: price, calUUID, versionId, gtiActId, basePrice
- `ModelQueryDto`: templateGroupCode default `HK_GROUP`, categoryId, searchKey (fuzzy model search!), showMemory
- `SamSungActionRequestVo`: orderId, newPhoneBuyDate, newPrdId, newPhoneMemoryId, mainOrderCode (all required) — likely the order-update/action payload

## Probe scripts
Saved in `~/.openclaw/workspace/tmp/`: `sign-test*.js`, `post-test*.js`, `price-*.js`, `option-test.js`, `probe-all.js`, `probe-order*.js`, `apifox-*.js`
Full schema dump: `%TEMP%/apifox-schemas.json` (312 schemas)
