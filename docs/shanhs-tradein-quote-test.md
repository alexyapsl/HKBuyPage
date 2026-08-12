# ShanHS trade-in quote-only test flow

Scope for this version: get a live ShanHS quote on the page, then keep the existing cart flow where the customer adds the trade-in device again in cart. ShanHS `submit/order` / trade-in locking is intentionally not included yet.

## What changed

- `index-aem-preorder-final.html`
  - Step 3 brand/model/storage now loads from `step3models_slim.json`.
  - Selecting all three opens an IMEI modal.
  - IMEI is validated as 15 alphanumeric chars.
  - Page calls `verify/imei`, then `price-cal` with best-condition answers.
  - Quote shown as `price + ticketPrice`.
  - Quote details are kept in `window.currentTradeInCalc` for a future submit/order integration.
- `step3models_slim.json`
  - Slim ShanHS dataset: 653 models / 1,173 storage variants / 9 brands.
  - `gtiFlag` is currently false for all models.
- `shanhs-proxy.js`
  - Local signing proxy. This is needed because the ShanHS test environment did not return `Access-Control-Allow-Origin` during browser CORS tests.

## Local test setup

1. Create `.env.shanhs.local` in the repo root. Do not commit this file.

```env
SHANHS_APP_ID=57
SHANHS_APP_SECRET=<toko.shs.app.secret.hk value>
```

2. Start the ShanHS proxy:

```bash
node shanhs-proxy.js
```

It listens on `http://localhost:8787` by default.

3. Serve the repo locally, for example:

```bash
npx http-server -p 8000
```

or:

```bash
python -m http.server 8000
```

4. Open:

```text
http://localhost:8000/index-aem-preorder-final.html
```

5. Test flow:
   - Pick the new device/storage/color as usual.
   - In Step 3, pick trade-in brand/model/storage.
   - Enter a 15-character IMEI.
   - Page should show the live ShanHS quote.
   - Add to cart still uses the existing warning/manual trade-in cart flow.

## Optional proxy override

The page defaults to `http://localhost:8787`. To point it at another proxy/backend:

```text
http://localhost:8000/index-aem-preorder-final.html?shanhsProxy=https://your-proxy.example
```

## Production note

Do not ship the ShanHS appSecret in browser JavaScript. For production, either:

- ShanHS enables CORS for the approved Samsung origin and signing moves to a backend endpoint, or
- keep a backend proxy like `shanhs-proxy.js` behind the site and point `shanhsProxy` to it.
