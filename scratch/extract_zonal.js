import fs from 'fs';
import path from 'path';

const zonalPath = 'd:/FullStackDevelopment/coreui/src/assets/converted/ZONAL_2024.json';
const docRef = 'HYDERABAD DIVISION-S AND T / Y-SG-36-2024-25-03 / 01052610118677';

function extract() {
    const rawData = fs.readFileSync(zonalPath, 'utf8');
    const data = JSON.parse(rawData);
    const items = [];
    let currentSchedule = '';

    data.forEach((table, tableIdx) => {
        // Skip table 0 as it is usually summary
        if (tableIdx === 0) return;

        table.forEach(row => {
            const rowText = row.join(' ');
            
            // Detect schedule
            const schedMatch = rowText.match(/Schedule\s+([A-Z])/i);
            if (schedMatch) {
                currentSchedule = schedMatch[1].toUpperCase();
            }

            // Detect item row: col 0 is slNo (number), col 1 is itemNo (number)
            if (currentSchedule && row.length >= 7) {
                const slNoStr = row[0]?.toString().trim();
                const itemNoStr = row[1]?.toString().trim();
                const desc = row[2]?.toString().trim();
                const unit = row[3]?.toString().trim();
                const qty = parseFloat(row[4]?.toString().replace(/,/g, ''));
                const rate = parseFloat(row[5]?.toString().replace(/,/g, ''));
                const amount = parseFloat(row[6]?.toString().replace(/,/g, ''));

                if (/^\d+$/.test(slNoStr) && /^\d+$/.test(itemNoStr) && desc && !isNaN(rate)) {
                    items.push({
                        slNo: parseInt(slNoStr),
                        description: desc,
                        unit: unit || 'Nos',
                        rateInRs: rate,
                        totalCashRs: amount,
                        totalRs: amount,
                        reference: `${docRef} / Schedule ${currentSchedule}`,
                        schedule: currentSchedule,
                        bidRate: rate
                    });
                }
            }
        });
    });

    console.log(JSON.stringify(items, null, 2));
}

extract();
