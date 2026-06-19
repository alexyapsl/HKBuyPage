# Adobe Analytics + GA4 Tagging Specification

This document defines the event tracking strategy for the **HKBuyPage** buying tool component when embedded in Adobe Experience Manager (AEM) pages.

---

## Tracking Architecture

- All user interactions are pushed to `window.dataLayer` as standardized events.
- Adobe Launch listens for the data layer event and routes data to:
  - **Adobe Analytics (AA)**
  - **Google Analytics 4 (GA4)**
- This approach keeps the component clean and decoupled from any specific analytics implementation.

---

## Core Event Structure

Every tracking call uses this format:

```js
window.dataLayer.push({
    event: 'pd_buying_tool_interaction',
    an_tr: 'product_option-flagship pdp-option selector-option_click3',
    an_ca: 'option click',
    an_ac: 'pd buying tool',
    an_la: 'memory:1 TB 16 GB',
    // Additional context (optional)
    sku: 'SM-F9660ZSDTGY',
    model: 'Galaxy Z Fold7',
    storage: '1TB',
    color: 'Blue Shadow',
    bank: 'boc',
    tradein_value: 8888,
    payment_method: 'samsungpay'
});
```

---

## Event Mapping Table

| User Action                    | `an_tr` (Classification)                                  | `an_la` (Label)                      | Extra Parameters                  | AA eVars          | GA4 Parameters                  |
|--------------------------------|-----------------------------------------------------------|--------------------------------------|-----------------------------------|-------------------|---------------------------------|
| Select new device (Step 1)     | `product_option-flagship pdp-option selector-option_click3` | `device:Galaxy Z Fold7`             | `model`                           | eVar1, eVar11     | `an_tr`, `an_la`, `model`       |
| Select storage (Step 2a)       | `product_option-flagship pdp-option selector-option_click3` | `storage:1TB`                       | `storage`, `model`                | eVar1, eVar12     | `an_tr`, `an_la`, `storage`     |
| Select color (Step 2b)         | `product_option-flagship pdp-option selector-option_click3` | `color:Blue Shadow`                 | `sku`, `color`, `model`           | eVar1, eVar10, eVar13 | `an_tr`, `an_la`, `sku`, `color` |
| Trade-in device selected       | `product_option-flagship pdp-option selector-option_click3` | `tradein:Galaxy S25 Ultra`          | `tradein_value`, `tradein_device`, `sku` | eVar1, eVar15  | `an_tr`, `an_la`, `tradein_value` |
| "No trade-in" checkbox         | `product_option-flagship pdp-option selector-option_click3` | `tradein:none`                      | `tradein_value: 0`                | eVar1, eVar15     | `an_tr`, `an_la`                |
| Bank promotion selected        | `product_option-flagship pdp-option selector-option_click3` | `bank:BOC`                          | `bank`                            | eVar1, eVar14     | `an_tr`, `an_la`, `bank`        |
| Samsung Pay toggled            | `product_option-flagship pdp-option selector-option_click3` | `payment:samsungpay`                | `payment_method`                  | eVar1, eVar16     | `an_tr`, `an_la`, `payment_method` |
| Click "Buy Now"                | `product_option-flagship pdp-option selector-option_click3` | `action:buy_now`                    | `final_price`, `sku`              | eVar1, eVar10     | `an_tr`, `an_la`, `final_price` |

---

## Implementation Notes

- All events use the same `an_tr` value for classification consistency (as per your example).
- `an_ca` is **always** `"option click"`.
- `an_ac` is **always** `"pd buying tool"`.
- Extra parameters (`sku`, `model`, `storage`, etc.) are passed as flat properties on the data layer event.
- Debug mode: Adding `?debug=analytics` to the URL will log every event to the browser console.

---

## Adobe Launch Rule Recommendation

Create a **Data Layer Event** rule in Adobe Launch:

- **Event Type**: Data Layer Event
- **Event Name**: `pd_buying_tool_interaction`
- **Conditions**: `an_tr` exists
- **Actions**:
  - Set Adobe Analytics variables:
    - `eVar1` ← `an_tr`
    - `eVar2` ← `an_ca`
    - `eVar3` ← `an_ac`
    - `eVar4` ← `an_la`
    - (Additional eVars for `sku`, `model`, `bank`, etc.)
  - Send Adobe Analytics beacon (s.tl)
  - Send GA4 event with all custom parameters

---

## File Reference

Tracking implementation lives in:
- `index.html` (bottom of `<script>` block)
- Function: `trackEvent(action, label, extra = {})`

---

_Last updated: 2026-06-19_