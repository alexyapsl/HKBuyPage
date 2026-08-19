# Samsung HK - Add to Cart via POST (Reusable Pattern)

This document describes the **POST-based add-to-cart flow** that replaces the old magic-link GET + 302 redirect pattern.

It supports:
- Multiple SKUs in one call
- Optional gifts (second product)
- Samsung Pay / voucher codes (separate POST)
- Proper Facebook Pixel + Google Ads tracking events

---

## 1. Overview

**Old flow (magic link):**
```
GET /tokocommercewebservices/v2/hk/addToCart/multi?redirect=CART&productCode[1]=...&productQty[1]=1&...
→ 302 redirect to /hk/cart   ← tracking parameters often lost
```

**New flow (recommended):**
1. `POST /tokocommercewebservices/v2/hk/addToCart/multi/?fields=BASIC`  
   Body: JSON array of products
2. (Optional) `POST /tokocommercewebservices/v2/hk/users/current/carts/current/vouchers?...`  
   Body: `{ voucherId: "SPAY2026", voucherPopup: false }`
3. Fire tracking events **before** the POSTs
4. Redirect (or let user click) to cart

---

## 2. Reusable JavaScript Function

```js
/**
 * Add multiple products to cart + optionally apply a voucher.
 * Fires FB Pixel + Google Ads events before the network calls.
 *
 * @param {Array}  products     - [{ productCode, qty, services? }]
 * @param {string} [voucherId]  - e.g. "SPAY2026"
 * @param {Object} [tracking]   - { fbPixelId?, awConversionId?, value?, currency?, items? }
 * @returns {Promise<{cartStatus: number, voucherStatus?: number}>}
 */
async function addToCartWithVoucher(products, voucherId = null, tracking = {}) {
    const currentLang = getCurrentLang();
    const apiLang = (currentLang === 'zh') ? 'hk' : 'hk_en';
    const ADD_TO_CART_URL = `https://api.shop.samsung.com/tokocommercewebservices/v2/${apiLang}/addToCart/multi/?fields=BASIC`;
    const VOUCHER_URL     = `https://p1-sms-api-cdn.shop.samsung.com/tokocommercewebservices/v2/${apiLang}/users/current/carts/current/vouchers?lang=${currentLang === 'zh' ? 'zh_HK' : 'en_HK'}&curr=HKD`;

    // 1. Fire tracking events (Facebook + Google Ads)
    if (typeof fbq === 'function' && tracking.fbPixelId) {
        fbq('track', 'AddToCart', {
            content_name: tracking.items?.map(i => i.item_name).join(', ') || 'Multiple products',
            content_ids:  tracking.items?.map(i => i.item_id) || products.map(p => p.productCode),
            value:        tracking.value || 0,
            currency:     tracking.currency || 'HKD'
        });
    }

    if (typeof gtag === 'function' && tracking.awConversionId) {
        gtag('event', 'add_to_cart', {
            currency: tracking.currency || 'HKD',
            value:    tracking.value || 0,
            items:    tracking.items || products.map(p => ({ item_id: p.productCode }))
        });

        gtag('event', 'conversion', {
            send_to:        tracking.awConversionId,
            value:          tracking.value || 0,
            currency:       tracking.currency || 'HKD',
            transaction_id: 'cart-' + Date.now()
        });
    }

    // 2. Add products to cart
    const cartRes = await fetch(ADD_TO_CART_URL, {
        method: 'POST',
        credentials: 'include',           // sends login cookies (JSESSIONID, jwt_token, etc.)
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Origin': 'https://www.samsung.com',
            'Referer': 'https://www.samsung.com/'
        },
        body: JSON.stringify(products)
    });

    if (!cartRes.ok) {
        if (cartRes.status === 400) {
            showErrorModal('Sorry, this product is unable to add to cart.');
            return { cartStatus: 400, voucherStatus: null };
        }
        throw new Error(`Add-to-cart failed: ${cartRes.status}`);
    }

    let voucherRes = null;
    if (voucherId) {
        voucherRes = await fetch(VOUCHER_URL, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Origin': 'https://www.samsung.com',
                'Referer': 'https://www.samsung.com/'
            },
            body: JSON.stringify({ voucherId, voucherPopup: false })
        });
    }

    return {
        cartStatus: cartRes.status,
        voucherStatus: voucherRes ? voucherRes.status : null
    };
}
```

---

## 3. Example Usage

```js
const products = [
    { productCode: 'SM-F9760ZKPTGY', qty: 1, services: [] },
    { productCode: 'SM-F9760ZVPTGY', qty: 1, services: [] }   // gift or second item
];

const tracking = {
    fbPixelId: '123456789012345',
    awConversionId: 'AW-123456789/AbCdEfGhIjKlmnOpQrStUv',
    value: 8888,
    currency: 'HKD',
    items: [
        { item_id: 'SM-F9760ZKPTGY', item_name: 'Galaxy Z Fold8 (color 1)' },
        { item_id: 'SM-F9760ZVPTGY', item_name: 'Galaxy Z Fold8 (color 2)' }
    ]
};

const result = await addToCartWithVoucher(products, 'SPAY2026', tracking);
console.log(result); // { cartStatus: 200, voucherStatus: 201 }

const currentLang = getCurrentLang();
const cartDomain = (currentLang === 'zh') ? 'https://shop.samsung.com/hk/cart' : 'https://shop.samsung.com/hk_en/cart';
window.location.href = cartDomain;
```

---

## 4. Error Handling (CORS-aware)

The reusable function and calling code must handle two environments:

- **Same-origin** (`www.samsung.com`, `shop.samsung.com`): `fetch` resolves and `cartRes.status === 400` is readable.
- **External domains** (`github.io`, any non-Samsung origin): CORS blocks the error response; the promise rejects and we land in `catch`.

**Recommended pattern** (used in `simulate-add-to-cart.html`):

```js
if (!cartRes.ok) {
    if (cartRes.status === 400) {
        showErrorModal('Sorry, this product is unable to add to cart.');
        return;
    }
    throw new Error(...);
}

} catch (err) {
    // Treat any failure on external domains as "unable to add to cart"
    showErrorModal('Sorry, this product is unable to add to cart.');
}
```

## 5. Important Notes

- **Login required** — `credentials: 'include'` only works if the user is already logged into `www.samsung.com` in the same browser.
- **CORS** — Calling this from `github.io` or any non-Samsung domain will usually fail. It works when the code runs on `www.samsung.com` or `shop.samsung.com`.
- **Cross-domain tracking** — Even with the correct events, the cart page (`shop.samsung.com/hk/cart`) may not inherit `fbclid` / `gclid` from external domains. This is a limitation of Samsung’s current cart implementation.
- **Gift items** — Pass them as additional objects in the `products` array (same as the 2-SKU example above).

---

## 5. Files

- Reusable function is documented above.
- Simulator test page: `simulate-add-to-cart.html` (contains working example of the two-step flow).
- Live page: `index-aem-preorder-final.html` (official Samsung trade-in chain + POST add-to-cart).
- Console tester: `console-tradein-test.js` (paste into DevTools on `samsung.com`; dry-run by default).

---

## 6. Official Samsung Trade-in Chain (validated 2026-08-19)

Validated end-to-end from a `samsung.com` console session: IMEI valid → assessment accepted (`discountAmount 6600`, `gtiPrice 6200`, `tickPrice 400`) → addToCart OK → trade-in device visible in cart.

### Chain

1. `validateImeiWithoutProduct` via JSONP (`shop.samsung.com/{lang}/servicesv2/validateImeiWithoutProduct`)
   - Works cross-origin because it is JSONP.
   - Success is `resultCode === '0000'`; otherwise show Samsung's localized `resultMessage`.
2. `getTradeInSimpleInfo` (`shop.samsung.com/{lang}/servicesv2/getTradeInSimpleInfo?productCode={SKU}`)
   - Initializes server-side trade-in state for the target product before assessment.
3. CSRF token (`shop.samsung.com/{lang}/security/csrf`)
   - Token is passed as query param `CSRFToken` on the assessment submit, not as a header.
4. Questionnaire (`api.shop.samsung.com/tokocommercewebservices/v2/{lang}/servicesv2/assessment/TRADE_IN?q={modelId}&provider=SHS`)
   - POST body is `{ "imei": "" }`.
5. `filterDevices` walk (`api.shop.samsung.com/tokocommercewebservices/v2/{lang}/tradeIn/services/filterDevices?key={key}&provider=SHS&mainProductCode={SKU}`)
   - Use the OCC variant on purpose: the storefront `/servicesv2/filterDevices` can 500 on Samsung model lists.
   - Walk levels: deviceType → brand → model → capacity (phones/tablets only) → purchaseChannel.
   - Set `mainBaseProductCode` on every selected node to the first two SKU segments (e.g. `SM-S9480`).
   - Rebuild each child `parent` as a minimal object (name/value only; other fields null/default), matching Samsung's own payload.
   - Notebooks (`categoryId === '3'`) are not supported by this online flow.
6. Assessment submit (`shop.samsung.com/{lang}/assessment/TRADE_IN/json?CSRFToken={token}&provider=SHS`)
   - Body shape: `{ imei, orderEntryNumber: 0, productCode: '1', responses, targetProductCode, selectionResponses }`.
   - `responses`: first answer of every question (best condition), plus `{ name: 'voucherCode' }` and `{ name: 'purchaseFrom', value: '0' }`.
   - Success requires `resultCode === '100'` and a `tradeInIdentifier` in `result.additionalInfos`.
   - `discountAmount` = total saving; `gtiPrice` = guaranteed device value; `tickPrice` = extra ticket/rebate.
7. addToCart (`POST .../addToCart/multi/?fields=BASIC`)
   - Main product gets `services: [{ serviceCode: 'T-SHS-TRADEIN', additionalInfos: [...] }]`.
   - `additionalInfos`: `IMEI` first, assessment `additionalInfos` verbatim (key/value only), and `usedPrice` last (`'gtiPrice,tickPrice'` when `gtiPrice > 0`, otherwise `'tickPrice'`).

### Gotchas learned today

- **Dry-run tester:** `console-tradein-test.js` intentionally has `DO_ADDTOCART = false`; seeing `DRY RUN done` means the chain worked and only the final cart POST was skipped. Set it to `true` for the real add.
- **Console paste syntax error:** a corrupted template expression (`${enco…ey)}`) caused `Uncaught SyntaxError: Missing } in template expression`. The checked-in tester must be `${encodeURIComponent(key)}`.
- **Do not assume JSON errors:** Samsung cart/assessment endpoints can return XML (`<List><item>...`) on failure. Never call `response.json()` blindly — log `status`, `content-type`, and a text snippet first.
- **Origin matters:** the full chain only works on `samsung.com` / `shop.samsung.com` origins because of CORS + cart/CSRF cookies. GitHub Pages can quote via JSONP/ShanHS, but cannot complete the official assessment/addToCart chain off-site.
- **Session state matters:** run the chain in the same browser session where the user is logged into Samsung; `credentials: 'include'` is required throughout.
- **Re-validate IMEI right before submit:** catches devices that became recycled/locked between quote and add-to-cart.

---

*Document created: 2026-08-02*  
*Last updated: 2026-08-19*