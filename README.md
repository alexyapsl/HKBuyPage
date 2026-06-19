# HKBuyPage

A self-contained single-page web application used to sell Galaxy devices in Hong Kong with a focus on **trade-in**, **bank promotions**, and **gift selection**.

It generates a **Samsung Magic Link** that pre-fills the correct SKU, quantity, trade-in value, bank rebate, LSV discount, Samsung Pay discount, and selected gifts directly into the Samsung Shop cart.

---

## Project Purpose

This page replaces the traditional product configurator flow. It is designed to be embedded or shared via QR code / SMS / app to drive high-intent sales with instant savings visibility.

### Core Flow (4 Steps)

| Step | Name                        | Description |
|------|-----------------------------|-----------|
| 1    | Select new device           | 3 Galaxy models (pulled from `step1models.json`) |
| 2    | Storage + Color             | Storage dropdown → inline color chips (Step 2b) using `recommendations.json` |
| 3    | Trade-in                    | Select trade-in device or "No device to trade-in" using `devices.json` |
| 4    | Bank + Payment              | Bank promotion selection + Samsung Pay toggle using `bankpromo.json` |

---

## Key Files

### Core Application

| File                  | Purpose |
|-----------------------|--------|
| `index.html`          | The complete single-page application. All logic, UI, and data loading lives here. |
| `style` (inline)      | Uses Tailwind CSS via CDN + custom Samsung styling. |

### Data Files (JSON)

| File                        | Source                  | Description |
|----------------------------|-------------------------|-----------|
| `recommendations.json`     | Google Sheet            | New device catalog. Contains SKU, price, LSV discount, gifts, OOS status, hexCode, `oosLink`, `showInHKBuyPage`, `estoreExclusive`. |
| `devices.json`             | `tradein_new.csv`       | Trade-in eligible devices. Contains `gti[]` and `eti[]` price maps per new-device SKU. |
| `gifts.json`               | Google Sheet            | List of available gifts per model + Active flag. |
| `bankpromo.json`           | Google Sheet            | Bank promotion rules (HSBC, BOC, etc.), rebate amounts, LSV, Samsung Pay rates. |
| `step1models.json`         | Generated               | Lightweight list of models shown in Step 1 (derived from recommendations). |

### Source & Builder Scripts

| File                              | Purpose |
|-----------------------------------|--------|
| `build_devices_from_sheet.js`     | Converts `tradein_new.csv` → `devices.json` (GTI/ETI mapping). |
| `build_recommendations.js`        | Regenerates `recommendations.json` from Google Sheet export. |
| `build_gifts.js`                  | Regenerates `gifts.json`. |
| `build_bankpromo.js`              | Regenerates `bankpromo.json`. |
| `build_step1models.js`            | Generates `step1models.json` from recommendations. |
| `tradein_new.csv`                 | Master trade-in data export from Google Sheets. |
| `devices prices 19062026.csv`     | Historical / backup trade-in CSV. |

---

## Data Pipeline

```
Google Sheets (multiple tabs)
        ↓ (export as CSV)
tradein_new.csv / recommendations_latest.csv / gifts.csv / bankpromo.csv
        ↓ (run build scripts)
devices.json / recommendations.json / gifts.json / bankpromo.json / step1models.json
        ↓
index.html (runtime)
```

- All JSON files are **generated** — do not edit them manually.
- The build scripts are designed to handle `N/A`, empty cells, and quoted values.

---

## Important Business Rules (Hardcoded in `index.html`)

- Trade-in only kicks in **after** a color (SKU) is selected.
- GTI/ETI lookup is **SKU-based** (not model-based).
- If a SKU has no entry in `devices.json`, the trade-in value falls back to `0`.
- Bank promotion only shows **after** Step 3 is completed.
- BOC is **auto-selected** the first time Step 4 appears.
- "No trade-in" checkbox clears all trade-in fields and shows Step 4 immediately.

---

## Development Workflow

1. Make changes in the relevant Google Sheet tab.
2. Export the tab as CSV (use the cache-bust parameter to avoid stale data).
3. Run the corresponding `build_*.js` script.
4. Test locally by opening `index.html`.
5. Commit both the updated CSV (optional) and the generated JSON + `index.html`.

### Testing the reverse-flow requirement

- Select a full path (color + trade-in + bank).
- Change color in Step 2b.
- Verify:
  - Trade-in value is recalculated with the new SKU.
  - Bank savings are updated.
  - "No trade-in" checkbox state is preserved if it was checked.

---

## Deployment

This is a static single-file application.

Recommended deployment:

- Host on GitHub Pages (already configured on `main` branch).
- Or any static hosting (Netlify, Vercel, S3, etc.).
- No backend or environment variables required.

---

## Future Improvements (Ideas)

- Move more logic out of `index.html` into separate JS modules.
- Add unit tests for `parseCSVLine` and trade-in calculation.
- Support multiple languages via `recommendations.json`.
- Add SKU-level gift conflict rules.

---

## Contact / Ownership

Maintained by the Samsung HK eCommerce team.

For questions about the data, contact the person managing the Google Sheet.