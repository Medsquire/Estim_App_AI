import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = __dirname;

// Normalize text for comparison
function normalizeText(value) {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Calculate token overlap ratio
function tokenOverlapRatio(aTokens, bTokens) {
  const aSet = new Set(aTokens);
  const bSet = new Set(bTokens);
  const intersection = aTokens.filter(t => bSet.has(t)).length;
  const maxLength = Math.max(aTokens.length, bTokens.length);
  return maxLength === 0 ? 0 : intersection / maxLength;
}

// Build SOR description set
function buildSorDescriptionSet() {
  const sorJsonPath = path.join(ROOT, 'Json', 'SOR', 'SOR.json');
  const sorRawData = fs.readFileSync(sorJsonPath, 'utf-8');
  const sorData = JSON.parse(sorRawData);

  const sorDescSet = new Set();
  const sorDescList = [];

  // Handle both flat array and nested items structure
  const items = Array.isArray(sorData) ? sorData : (sorData.items || []);

  items.forEach(item => {
    const normalizedDesc = normalizeText(item.description);
    sorDescSet.add(normalizedDesc);
    sorDescList.push({
      original: item.description,
      normalized: normalizedDesc,
      chapter: item.chapter,
      item_no: item.item_no
    });
  });

  return { sorDescSet, sorDescList };
}

// Match SOR description
function matchSorDescription(description, sorDescSet, sorDescList) {
  if (!description) {
    return { isSor: false, matchedSorDescription: '' };
  }

  const normalizedDesc = normalizeText(description);
  const descTokens = normalizedDesc.split(/\s+/).filter(t => t.length > 0);

  // Level 1: Exact match
  if (sorDescSet.has(normalizedDesc)) {
    const match = sorDescList.find(item => item.normalized === normalizedDesc);
    return {
      isSor: true,
      matchedSorDescription: match.original
    };
  }

  // Level 2: Containment check (for longer strings)
  for (const sorItem of sorDescList) {
    if (normalizedDesc.length >= 20 && sorItem.normalized.includes(normalizedDesc)) {
      return {
        isSor: true,
        matchedSorDescription: sorItem.original
      };
    }
    if (normalizedDesc.length >= 20 && normalizedDesc.includes(sorItem.normalized)) {
      return {
        isSor: true,
        matchedSorDescription: sorItem.original
      };
    }
  }

  // Level 3: Token overlap ratio
  for (const sorItem of sorDescList) {
    const sorTokens = sorItem.normalized.split(/\s+/).filter(t => t.length > 0);
    if (descTokens.length >= 8 && sorTokens.length >= 8) {
      const ratio = tokenOverlapRatio(descTokens, sorTokens);
      if (ratio >= 0.72) {
        return {
          isSor: true,
          matchedSorDescription: sorItem.original
        };
      }
    }
  }

  return { isSor: false, matchedSorDescription: '' };
}

// Main function
async function enrichLc27Inventory() {
  const filePath = path.join(ROOT, 'src', 'assets', 'converted', 'LC_27_EST_INVENTORY.json');

  console.log('Reading LC 27 EST inventory file...');
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const inventory = JSON.parse(fileContent);

  console.log('Building SOR reference set...');
  const { sorDescSet, sorDescList } = buildSorDescriptionSet();

  console.log(`Processing ${inventory.length} items...`);
  let sorCount = 0;
  let notCount = 0;

  // Enrich each item
  inventory.forEach((item, index) => {
    const matchResult = matchSorDescription(item.description, sorDescSet, sorDescList);
    item.fileType = matchResult.isSor ? 'SOR' : 'NOT';
    item.matchedSorDescription = matchResult.matchedSorDescription;

    if (matchResult.isSor) {
      sorCount++;
      console.log(`  ✓ Item ${item.slNo}: SOR MATCH - "${item.description.substring(0, 60)}..."`);
    } else {
      notCount++;
    }
  });

  console.log(`\nEnrichment complete!`);
  console.log(`Total items: ${inventory.length}`);
  console.log(`SOR items: ${sorCount}`);
  console.log(`NOT items: ${notCount}`);

  // Write enriched file
  fs.writeFileSync(filePath, JSON.stringify(inventory, null, 2), 'utf-8');
  console.log(`\n✅ File written to: ${filePath}`);
}

enrichLc27Inventory().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
