import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourcePath = path.join(__dirname, 'Json', 'SOR', 'SOR.json');
const targetPath = path.join(__dirname, 'src', 'assets', 'converted', 'SOR.json');

function flattenSource(source) {
  if (Array.isArray(source?.items)) {
    return source.items;
  }

  const chapters = source?.chapters || {};
  const flattened = [];

  for (const [chapterKey, chapterData] of Object.entries(chapters)) {
    const chapterNo = Number(chapterKey);
    for (const item of chapterData?.items || []) {
      flattened.push({
        chapter: Number.isFinite(chapterNo) ? chapterNo : item.chapter,
        item_no: item.item_no,
        description: item.description,
        unit: item.unit,
        rate: item.rate,
        sub_items: Array.isArray(item.sub_items) ? item.sub_items : undefined
      });
    }
  }

  return flattened;
}

const sourceRaw = fs.readFileSync(sourcePath, 'utf8');
const source = JSON.parse(sourceRaw);

const items = flattenSource(source);
const output = {
  document: source.document || 'SOR',
  extraction_range: source.extraction_range || '',
  total_chapters_processed: source.total_chapters_processed || '1 to 47',
  items
};

fs.writeFileSync(targetPath, JSON.stringify(output, null, 2), 'utf8');

const has103 = items.some((it) => it.item_no === '103');
console.log(`Wrote ${items.length} items to ${targetPath}`);
console.log(`Contains item 103: ${has103 ? 'YES' : 'NO'}`);
