import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('.');
const SOR_PATH = path.join(ROOT, 'Json', 'SOR', 'SOR.json');

const SOURCES = [
  {
    fileName: 'LOA ABSS.pdf',
    inputJson: path.join(ROOT, 'src', 'assets', 'converted', 'LOA_ABSS.json')
  },
  {
    fileName: 'STTC.pdf',
    inputJson: path.join(ROOT, 'src', 'assets', 'converted', 'STTC.json')
  },
  {
    fileName: 'zonal2024_loa.pdf',
    inputJson: path.join(ROOT, 'src', 'assets', 'converted', 'ZONAL_2024.json')
  }
];

const OUTPUT_PATH = path.join(ROOT, 'src', 'assets', 'converted', 'LOA_ITEMS_WITH_FILETYPE.json');
const PER_FILE_OUTPUTS = {
  'LOA ABSS.pdf': path.join(ROOT, 'src', 'assets', 'converted', 'LOA_ABSS_WITH_FILETYPE.json'),
  'STTC.pdf': path.join(ROOT, 'src', 'assets', 'converted', 'STTC_WITH_FILETYPE.json'),
  'zonal2024_loa.pdf': path.join(ROOT, 'src', 'assets', 'converted', 'ZONAL_2024_WITH_FILETYPE.json')
};

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSorDescriptionSet() {
  const sor = JSON.parse(fs.readFileSync(SOR_PATH, 'utf8'));
  const items = Array.isArray(sor?.items) ? sor.items : [];
  const set = new Set();
  const list = [];

  for (const item of items) {
    if (item?.description) {
      const normalized = normalizeText(item.description);
      set.add(normalized);
      list.push({
        original: String(item.description),
        normalized,
        tokens: normalized.split(' ').filter(Boolean)
      });
    }
  }

  return { set, list };
}

function tokenOverlapRatio(aTokens, bTokens) {
  if (!aTokens.length || !bTokens.length) return 0;
  const bSet = new Set(bTokens);
  let intersection = 0;
  for (const token of aTokens) {
    if (bSet.has(token)) intersection++;
  }

  return intersection / Math.max(aTokens.length, bTokens.length);
}

function matchSorDescription(description, sorData) {
  const normalized = normalizeText(description);
  if (!normalized) {
    return { isSor: false, matchedSorDescription: '' };
  }

  if (sorData.set.has(normalized)) {
    const found = sorData.list.find(x => x.normalized === normalized);
    return {
      isSor: true,
      matchedSorDescription: found?.original || ''
    };
  }

  const descTokens = normalized.split(' ').filter(Boolean);

  for (const sorEntry of sorData.list) {
    const a = normalized;
    const b = sorEntry.normalized;

    if (a.length >= 20 && b.length >= 20 && (a.includes(b) || b.includes(a))) {
      return {
        isSor: true,
        matchedSorDescription: sorEntry.original
      };
    }

    const overlap = tokenOverlapRatio(descTokens, sorEntry.tokens);
    if (overlap >= 0.72 && descTokens.length >= 8 && sorEntry.tokens.length >= 8) {
      return {
        isSor: true,
        matchedSorDescription: sorEntry.original
      };
    }
  }

  return { isSor: false, matchedSorDescription: '' };
}

function getHeaderIndexes(headerRow) {
  const indexes = {
    sno: -1,
    itemNo: -1,
    description: -1,
    unit: -1,
    qty: -1,
    rate: -1,
    amount: -1
  };

  headerRow.forEach((cell, index) => {
    const t = normalizeText(cell);
    if (t === 's no' || t === 'sno' || t === 'item sno') indexes.sno = index;
    else if (t === 'item no' || t === 'itemno') indexes.itemNo = index;
    else if (t.includes('description of item') || t === 'item desc' || t === 'description') indexes.description = index;
    else if (t === 'unit' || t === 'qty unit') indexes.unit = index;
    else if (t === 'qty' || t === 'item qty') indexes.qty = index;
    else if (t === 'rate' || t.includes('unit rate')) indexes.rate = index;
    else if (t === 'amount' || t.includes('bid amount') || t.includes('advt value')) indexes.amount = index;
  });

  return indexes;
}

function getValue(row, idx) {
  if (idx < 0 || idx >= row.length) return '';
  return String(row[idx] ?? '').trim();
}

function looksLikeDataRow(firstCell) {
  const t = normalizeText(firstCell);
  if (!t) return false;
  if (t.startsWith('schedule')) return false;
  if (t.startsWith('item ')) return false;
  if (t.startsWith('total')) return false;
  if (t.startsWith('net bid value')) return false;
  if (t.startsWith('rebate')) return false;
  return true;
}

function extractItemsFromTables(tables, sorData, sourceMeta) {
  const items = [];
  let activeSchedule = '';

  for (const table of tables) {
    if (!Array.isArray(table)) continue;

    let headerIndexes = null;

    for (let r = 0; r < table.length; r++) {
      const row = Array.isArray(table[r]) ? table[r] : [];
      const rowText = row.map(c => String(c ?? '').trim()).join(' ').trim();
      const firstCell = String(row[0] ?? '').trim();
      const secondCell = String(row[1] ?? '').trim();

      if (/^Schedule\b/i.test(firstCell) && secondCell) {
        activeSchedule = secondCell;
      }

      const normalizedJoined = normalizeText(rowText);
      if (normalizedJoined.includes('description of item') && normalizedJoined.includes('item no')) {
        headerIndexes = getHeaderIndexes(row);
        continue;
      }

      if (!headerIndexes) continue;
      if (!looksLikeDataRow(firstCell)) continue;

      const description = getValue(row, headerIndexes.description);
      if (!description) continue;

      const match = matchSorDescription(description, sorData);
      const fileType = match.isSor ? 'SOR' : 'NOT';

      items.push({
        sourceFile: sourceMeta.fileName,
        sourceJson: path.basename(sourceMeta.inputJson),
        schedule: activeSchedule,
        sno: getValue(row, headerIndexes.sno),
        itemNo: getValue(row, headerIndexes.itemNo),
        description,
        unit: getValue(row, headerIndexes.unit),
        qty: getValue(row, headerIndexes.qty),
        rate: getValue(row, headerIndexes.rate),
        amount: getValue(row, headerIndexes.amount),
        FileType: fileType,
        matchedSorDescription: match.matchedSorDescription
      });
    }
  }

  return items;
}

function main() {
  const sorData = buildSorDescriptionSet();
  const files = [];
  let allItems = [];

  for (const source of SOURCES) {
    const raw = JSON.parse(fs.readFileSync(source.inputJson, 'utf8'));
    const tables = Array.isArray(raw) ? raw : [];
    const items = extractItemsFromTables(tables, sorData, source);

    const sorCount = items.filter(i => i.FileType === 'SOR').length;
    const notCount = items.length - sorCount;

    files.push({
      fileName: source.fileName,
      inputJson: path.relative(ROOT, source.inputJson).replace(/\\/g, '/'),
      totalItems: items.length,
      sorItems: sorCount,
      notItems: notCount,
      items
    });

    allItems = allItems.concat(items);

    const perFileOutput = {
      generatedAt: new Date().toISOString(),
      matchingRule: 'Normalized description match against Json/SOR.json using exact, containment, and high token-overlap',
      fileName: source.fileName,
      inputJson: path.relative(ROOT, source.inputJson).replace(/\\/g, '/'),
      totals: {
        allItems: items.length,
        sorItems: sorCount,
        notItems: notCount
      },
      items
    };

    const perFilePath = PER_FILE_OUTPUTS[source.fileName];
    if (perFilePath) {
      fs.writeFileSync(perFilePath, JSON.stringify(perFileOutput, null, 2), 'utf8');
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    matchingRule: 'Normalized description match against Json/SOR.json using exact, containment, and high token-overlap',
    sources: SOURCES.map(s => ({
      fileName: s.fileName,
      inputJson: path.relative(ROOT, s.inputJson).replace(/\\/g, '/')
    })),
    totals: {
      allItems: allItems.length,
      sorItems: allItems.filter(i => i.FileType === 'SOR').length,
      notItems: allItems.filter(i => i.FileType === 'NOT').length
    },
    files,
    allItems
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Generated: ${OUTPUT_PATH}`);
  console.log(`Total items: ${output.totals.allItems}`);
  console.log(`SOR: ${output.totals.sorItems}, NOT: ${output.totals.notItems}`);
}

main();
