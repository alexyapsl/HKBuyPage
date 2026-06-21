const fs = require('fs');
const path = require('path');

// Bank Promotion Sheet
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/14qeOckxBspQVFUi_WhZrOLuUrnCOnQ7uWodf81aNG40/gviz/tq?tqx=out:csv';

async function buildBankPromo() {
    try {
        const res = await fetch(SHEET_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const csv = await res.text();

        const lines = csv.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());

        const headerMap = {};
        headers.forEach((h, i) => { headerMap[h] = i; });

        const banks = [];

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;

            const values = parseCSVLine(lines[i]);
            if (values.length < headers.length) continue;

            const bank = {
                key: (values[headerMap['Bank Name EN']] || values[headerMap['Bank Name']] || '').toLowerCase().replace(/\s+/g, ''),
                name: {
                    en: values[headerMap['Bank Name EN']] || values[headerMap['Bank Name']] || '',
                    zh: values[headerMap['Bank Name ZH']] || ''
                },
                logo: values[headerMap['Logo']] || '',
                tiers: [],
                maximum: parseInt(values[headerMap['Maximum']]) || 0,
                fixedDiscount: null,
                priority: parseInt(values[headerMap['Priority']]) || 999,
                isRecommended: (values[headerMap['Recommendation']] || '').toUpperCase() === 'Y'
            };

            // Parse tiers
            const tierColumns = [
                { max: 'Tier1', percent: 'Tier1 Percentage Discount' },
                { max: 'Tier2', percent: 'Tier2 Percentage Discount' },
                { max: 'Tier3', percent: 'Tier3 Percentage Discount' },
                { max: 'Tier4', percent: 'Tier4 Percentage Discount' }
            ];

            tierColumns.forEach(col => {
                const maxVal = parseInt(values[headerMap[col.max]]) || 0;
                const percentStr = values[headerMap[col.percent]] || '';
                const percent = parseFloat(percentStr) / 100;

                if (maxVal > 0) {
                    bank.tiers.push({ max: maxVal, percent });
                }
            });

            // Fixed discount (if present) - bilingual
            const fixedNameEn = values[headerMap['FixedDiscount1 EN']] || values[headerMap['FixedDiscount1']] || '';
            const fixedNameZh = values[headerMap['FixedDiscount1 ZH']] || '';
            const fixedValue = parseInt(values[headerMap['Fixed Discount1 Value']]) || 0;
            if ((fixedNameEn || fixedNameZh) && fixedValue > 0) {
                bank.fixedDiscount = {
                    name: {
                        en: fixedNameEn,
                        zh: fixedNameZh || fixedNameEn
                    },
                    value: fixedValue
                };
            }

            if (bank.key) banks.push(bank);
        }

        // Write bankpromo.json
        fs.writeFileSync(
            path.join(__dirname, 'bankpromo.json'),
            JSON.stringify(banks, null, 2),
            'utf8'
        );

        console.log(`Generated bankpromo.json with ${banks.length} banks`);
    } catch (e) {
        console.error('Failed to build bankpromo.json:', e.message);
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

buildBankPromo();