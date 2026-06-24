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

        // Force Clean column format parser (Sheet structure confirmed as standard columns)
        const headerMap = {};
        rawHeaders.forEach((h, i) => { headerMap[h] = i; });

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const v = parseCSVLine(lines[i]);

            gifts.push({
                GiftCode: v[headerMap['GiftCode']] || '',
                Mode: v[headerMap['Mode']] || '',
                SKU_PromoCode: v[headerMap['SKU_PromoCode']] || '',
                'GiftNameEN': v[headerMap['Gift Name EN']] || v[headerMap['Gift_Name_EN']] || '',
                'GiftNameZH': v[headerMap['Gift Name ZH']] || v[headerMap['Gift_Name_ZH']] || '',
                'SKU Image': v[headerMap['SKU Image']] || '',
                Price: v[headerMap['Price']] || '',
                'Parent Model': v[headerMap['Parent Model']] || '',
                Active: (v[headerMap['Active']] || '').toUpperCase() === 'Y' ? 'Y' : 'N'
            });
        }

        // Deduplicate: keep the first occurrence of each GiftCode + Parent Model combination
const seen = new Set();
        const uniqueGifts = gifts.filter(g => {
            const key = `${g.GiftCode}|${g['Parent Model']}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        fs.writeFileSync(
            path.join(__dirname, 'gifts.json'),
            JSON.stringify(uniqueGifts, null, 2),
            'utf8'
        );

        console.log(`Generated gifts.json with ${uniqueGifts.length} unique entries (from ${gifts.length} raw rows)`);
    } catch (e) {
        console.error('Failed to build gifts.json:', e.message);
    }
}

// Helper: get value by header index (with bounds check)
function getValue(values, headers, idx) {
    if (idx === undefined || idx < 0 || idx >= values.length) return '';
    return values[idx] || '';
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