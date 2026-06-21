const fs = require('fs');
const path = require('path');

// Gift Sheet - supports both clean columns and the merged Google Sheets export format
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1bXyzOFAQEozdzRcLiLgkBC7AkZtfnlgDlsQsXN4s5kg/gviz/tq?tqx=out:csv';

async function buildGifts() {
    try {
        const res = await fetch(SHEET_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const csv = await res.text();

        const lines = csv.trim().split('\n');
        const headerLine = lines[0];
        const rawHeaders = parseCSVLine(headerLine);

        const gifts = [];

        // Detect if this is the "merged" format (common with Google Sheets wide tables)
        const isMergedFormat = rawHeaders.some(h => h.includes(' S26U_') || h.includes(' AddSKU'));

        if (isMergedFormat) {
            // === Merged format parser ===
            // Example headers: "GiftCode S26U_Gift001 S26U_Gift002", "Mode AddSKU AddSKU", ...
            const giftSlots = extractGiftSlots(rawHeaders);

            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;

                const values = parseCSVLine(lines[i]);

                giftSlots.forEach(slot => {
                    const giftCode = getValue(values, rawHeaders, slot.giftCodeIdx);
                    if (!giftCode) return;

                    gifts.push({
                        GiftCode: giftCode,
                        Mode: getValue(values, rawHeaders, slot.modeIdx),
                        SKU_PromoCode: getValue(values, rawHeaders, slot.promoIdx),
                        'SKU Name': getValue(values, rawHeaders, slot.nameEnIdx),
                        'SKU Name ZH': getValue(values, rawHeaders, slot.nameZhIdx),
                        'SKU Image': getValue(values, rawHeaders, slot.imageIdx),
                        Price: getValue(values, rawHeaders, slot.priceIdx),
                        'Parent Model': getValue(values, rawHeaders, slot.parentIdx),
                        Active: getValue(values, rawHeaders, slot.activeIdx).toUpperCase() === 'Y' ? 'Y' : 'N'
                    });
                });
            }
        } else {
            // === Clean column format (fallback) ===
            const headerMap = {};
            rawHeaders.forEach((h, i) => { headerMap[h] = i; });

            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                const v = parseCSVLine(lines[i]);

                gifts.push({
                    GiftCode: v[headerMap['GiftCode']] || '',
                    Mode: v[headerMap['Mode']] || '',
                    SKU_PromoCode: v[headerMap['SKU_PromoCode']] || '',
                    'SKU Name': v[headerMap['SKU Name']] || v[headerMap['SKU_Name_EN']] || '',
                    'SKU Name ZH': v[headerMap['SKU Name ZH']] || v[headerMap['SKU_Name_ZH']] || '',
                    'SKU Image': v[headerMap['SKU Image']] || '',
                    Price: v[headerMap['Price']] || '',
                    'Parent Model': v[headerMap['Parent Model']] || '',
                    Active: (v[headerMap['Active']] || '').toUpperCase() === 'Y' ? 'Y' : 'N'
                });
            }
        }

        fs.writeFileSync(
            path.join(__dirname, 'gifts.json'),
            JSON.stringify(gifts, null, 2),
            'utf8'
        );

        console.log(`Generated gifts.json with ${gifts.length} entries`);
    } catch (e) {
        console.error('Failed to build gifts.json:', e.message);
    }
}

// Helper: get value by header index (with bounds check)
function getValue(values, headers, idx) {
    if (idx === undefined || idx < 0 || idx >= values.length) return '';
    return values[idx] || '';
}

// Detect gift slots from merged headers like "GiftCode S26U_Gift001 S26U_Gift002"
function extractGiftSlots(headers) {
    const slots = [];

    // Find the GiftCode header which usually contains all gift codes for the row
    const giftCodeHeaderIdx = headers.findIndex(h => h.startsWith('GiftCode'));
    if (giftCodeHeaderIdx === -1) return slots;

    const giftCodes = headers[giftCodeHeaderIdx].split(' ').slice(1); // skip "GiftCode"

    giftCodes.forEach((code, slotIndex) => {
        // For each gift code we find the corresponding column indices for other fields
        const modeHeader = headers.find(h => h.startsWith('Mode'));
        const promoHeader = headers.find(h => h.startsWith('SKU_PromoCode'));
        const nameEnHeader = headers.find(h => h.includes('SKU_Name_EN') || h.includes('SKU Name'));
        const nameZhHeader = headers.find(h => h.includes('SKU_Name_ZH'));
        const imageHeader = headers.find(h => h.includes('SKU Image'));
        const priceHeader = headers.find(h => h.startsWith('Price'));
        const parentHeader = headers.find(h => h.includes('Parent Model'));
        const activeHeader = headers.find(h => h.startsWith('Active'));

        // In merged format, values are space-separated in the same order as the codes
        slots.push({
            giftCodeIdx: giftCodeHeaderIdx,
            modeIdx: headers.indexOf(modeHeader),
            promoIdx: headers.indexOf(promoHeader),
            nameEnIdx: headers.indexOf(nameEnHeader),
            nameZhIdx: headers.indexOf(nameZhHeader),
            imageIdx: headers.indexOf(imageHeader),
            priceIdx: headers.indexOf(priceHeader),
            parentIdx: headers.indexOf(parentHeader),
            activeIdx: headers.indexOf(activeHeader),
            slotIndex
        });
    });

    return slots;
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

buildGifts();