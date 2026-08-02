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
    const ADD_TO_CART_URL = 'https://api.shop.samsung.com/tokocommercewebservices/v2/hk/addToCart/multi/?fields=BASIC';
    const VOUCHER_URL     = 'https://p1-sms-api-cdn.shop.samsung.com/tokocommercewebservices/v2/hk/users/current/carts/current/vouchers?lang=zh_HK&curr=HKD';

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

window.location.href = 'https://shop.samsung.com/hk/cart';
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

---

*Document created: 2026-08-02*  
*Last updated: 2026-08-02*