const fs = require('fs');
const path = require('path');

// Gift Sheet (direct fetch to avoid encoding issues)
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1bXyzOFAQEozdzRcLiLgkBC7AkZtfnlgDlsQsXN4s5kg/gviz/tq?tqx=out:csv';

async function buildGifts() {
    try {
        const res = await fetch(SHEET_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const csv = await res.text();

        const lines = csv.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());

        const headerMap = {};
        headers.forEach((h, i) => { headerMap[h] = i; });

        const gifts = [];

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;

            const values = parseCSVLine(lines[i]);
            if (values.length < headers.length) continue;

            const gift = {
                model: values[headerMap['Model']] || '',
                gift1: {
                    en: values[headerMap['SKU_Name_EN']] || values[headerMap['SKU_Name']] || '',
                    zh: values[headerMap['SKU_Name_ZH']] || ''
                },
                gift2: {
                    en: values[headerMap['SKU_Name2_EN']] || values[headerMap['SKU_Name2']] || '',
                    zh: values[headerMap['SKU_Name2_ZH']] || ''
                },
                gift3: {
                    en: values[headerMap['SKU_Name3_EN']] || values[headerMap['SKU_Name3']] || '',
                    zh: values[headerMap['SKU_Name3_ZH']] || ''
                },
                active: (values[headerMap['Active']] || '').toUpperCase() === 'Y'
            };

            gifts.push(gift);
        }

        fs.writeFileSync(
            path.join(__dirname, 'gifts.json'),
            JSON.stringify({ gifts }, null, 2),
            'utf8'
        );

        console.log(`Generated gifts.json with ${gifts.length} entries`);
    } catch (e) {
        console.error('Failed to build gifts.json:', e.message);
    }
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