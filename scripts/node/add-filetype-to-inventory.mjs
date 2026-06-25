import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// SOR Reference Data - South Central Railway Signal & Telecommunication Schedule of Rates 2024
const SOR_REFERENCE_DATA = {
  "items": [
    {"chapter": 1, "item_no": "101", "description": "Supply of CLS Post 140mm dia to specification IRS:S 6-81 Rev.3 or latest"},
    {"chapter": 1, "item_no": "102", "description": "Supply of CLS Ladder set complete with staging/platform, supports, cast iron ladder base/Shoe"},
    {"chapter": 1, "item_no": "104", "description": "Supply of Metallic (MS) colour light Signal Unit"},
    {"chapter": 1, "item_no": "105", "description": "Supply of FRP type colour light signal unit as per RDSO Spec no. RDSO/SPN/194/2006 Rev. 2.0 or latest"},
    {"chapter": 1, "item_no": "111", "description": "Supply of LED type (White Colour) route indicator"},
    {"chapter": 1, "item_no": "112", "description": "Supply of Colour LED Signal of various type working on 110V AC"},
    {"chapter": 2, "item_no": "201", "description": "Supply of GKP type Location Boxes"},
    {"chapter": 3, "item_no": "301", "description": "Supply of GI termination box (10 SWG) for point machine"},
    {"chapter": 3, "item_no": "302", "description": "Supply of Ground connections for point machines"},
    {"chapter": 4, "item_no": "401", "description": "Supply of Track feed battery charger"},
    {"chapter": 5, "item_no": "501", "description": "Supply of Plug-in type miniature tractive armature Non-AC immune, DC neutral line relay"},
    {"chapter": 5, "item_no": "502", "description": "Supply of 24 V DC plug-in type miniature tractive armature, AC immune relay"},
    {"chapter": 6, "item_no": "601", "description": "Supply of powder coated Relay rack universal type"},
    {"chapter": 7, "item_no": "701", "description": "Supply of 60 core Indoor Cable with 0.6mm conductor diameter"},
    {"chapter": 8, "item_no": "801", "description": "Supply of Battery Charger of Various capacity"},
    {"chapter": 9, "item_no": "901", "description": "Supply of Domino type operation cum indication panel to suit 3/4 road station"},
    {"chapter": 10, "item_no": "1001", "description": "Supply of Thermo shrink jointing kit for jointing underground 0.9mm dia conductor 6 quad cable"},
    {"chapter": 11, "item_no": "1101", "description": "Supply of Electric Key Transmitter (EKT) rotary type"},
    {"chapter": 13, "item_no": "1301", "description": "Supply of IB Resetting Panel"},
    {"chapter": 14, "item_no": "1401", "description": "Supply of Single Section Digital Axle Counter (SSDAC)"},
    {"chapter": 15, "item_no": "1501", "description": "Supply of basic material to construct unit Maintenance Free Earth"},
    {"chapter": 16, "item_no": "1601", "description": "Supply of Electrically Operated Lifting Barrier related items"},
    {"chapter": 17, "item_no": "1701", "description": "Supply of piezo buzzers working on 24 V DC reputed make"},
    {"chapter": 18, "item_no": "1801", "description": "Supply of Spares and accessories for UFSBI"},
    {"chapter": 25, "item_no": "2501", "description": "Location survey for cable route and preparation of tentative cable route plan"},
    {"chapter": 26, "item_no": "2601", "description": "Location box foundation and erection (Full size)"},
    {"chapter": 27, "item_no": "2701", "description": "Fabrication, supply and erection of conventional Earth"},
    {"chapter": 28, "item_no": "2801", "description": "Foundation and erection of Colour light signal"},
    {"chapter": 29, "item_no": "2901", "description": "Fixing of universal point machines and wiring"},
    {"chapter": 30, "item_no": "3001", "description": "Fixing of Track lead junction box"},
    {"chapter": 31, "item_no": "3101", "description": "Manufacture, supply and fixing of Sighting Board"},
    {"chapter": 32, "item_no": "3201", "description": "Erection and concreting of SM's control panel"},
    {"chapter": 33, "item_no": "3301", "description": "Transportation of materials"},
    {"chapter": 34, "item_no": "3401", "description": "Installation and wiring of all power supply equipment"},
    {"chapter": 35, "item_no": "3501", "description": "Arranging of sufficient staff by contractor and giving test"},
    {"chapter": 36, "item_no": "3601", "description": "Foundation, Erection, Testing and Commissioning of Electrically operated lifting barriers"},
    {"chapter": 37, "item_no": "3701", "description": "Fixing and erection of Axle Counter single entry type"},
    {"chapter": 38, "item_no": "3801", "description": "Fixing of Solar panels"},
    {"chapter": 39, "item_no": "3901", "description": "Design of SIP in Auto Cad"},
    {"chapter": 40, "item_no": "4001", "description": "Removal of existing 'Q' style / K-50 contact clips"},
    {"chapter": 41, "item_no": "4101", "description": "Supply of Hot Standby Electronic Interlocking System"},
    {"chapter": 42, "item_no": "4201", "description": "Supply, Installation and commissioning of Universal Fail safe Block interface"},
    {"chapter": 43, "item_no": "4301", "description": "Supply of Fire Alarm Control Panel"},
    {"chapter": 44, "item_no": "4401", "description": "Fabrication and supply of wall mounted maintainer's Tool Kit frame"},
    {"chapter": 45, "item_no": "4501", "description": "Releasing of the following equipments"},
    {"chapter": 46, "item_no": "4601", "description": "Installation, wiring, testing & commissioning of 2 wire DTMF Selective Calling Telephone"},
    {"chapter": 47, "item_no": "4701", "description": "Supply of station TCAS Equipment"}
  ]
};

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function buildSorDescriptionSet() {
  const set = new Set();
  const list = [];
  
  for (const item of SOR_REFERENCE_DATA.items) {
    if (item.description) {
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

function matchSorDescription(description) {
  const sorData = buildSorDescriptionSet();
  const normalized = normalizeText(description);
  
  if (!normalized) {
    return { isSor: false, matchedSorDescription: '' };
  }

  // Exact match
  if (sorData.set.has(normalized)) {
    const found = sorData.list.find(x => x.normalized === normalized);
    return {
      isSor: true,
      matchedSorDescription: found?.original || ''
    };
  }

  const descTokens = normalized.split(' ').filter(Boolean);

  // Containment and token overlap
  for (const sorEntry of sorData.list) {
    const a = normalized;
    const b = sorEntry.normalized;

    // Check containment for long strings
    if (a.length >= 20 && b.length >= 20 && (a.includes(b) || b.includes(a))) {
      return {
        isSor: true,
        matchedSorDescription: sorEntry.original
      };
    }

    // Check token overlap for high similarity
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

// Read the current file
const filePath = path.join(__dirname, 'src/app/views/estimations/work-details/inventory-data.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// Extract the array content between [ and ];
const arrayStartIdx = content.indexOf('EXTRACTED_INVENTORY = [');
const arrayStart = content.indexOf('[', arrayStartIdx);
const arrayEnd = content.lastIndexOf(']');

if (arrayStart === -1 || arrayEnd === -1) {
  console.error('Could not find EXTRACTED_INVENTORY array');
  process.exit(1);
}

// Parse items by finding { and matching }
let items = [];
let braceCount = 0;
let currentItemStart = -1;

for (let i = arrayStart + 1; i < arrayEnd; i++) {
  if (content[i] === '{') {
    if (braceCount === 0) currentItemStart = i;
    braceCount++;
  } else if (content[i] === '}') {
    braceCount--;
    if (braceCount === 0 && currentItemStart !== -1) {
      const itemStr = content.substring(currentItemStart, i + 1);
      try {
        // Carefully eval the JSON-like object
        const itemObj = eval('(' + itemStr + ')');
        items.push({ str: itemStr, obj: itemObj });
      } catch (e) {
        console.error('Failed to parse item:', e.message);
      }
    }
  }
}

console.log(`Found ${items.length} items to process`);

// Process each item and add fileType
let sorCount = 0;
let notCount = 0;

items.forEach((item, idx) => {
  const match = matchSorDescription(item.obj.description);
  
  if (match.isSor) {
    sorCount++;
  } else {
    notCount++;
  }

  // Add fileType and matchedSorDescription to the object
  item.obj.fileType = match.isSor ? 'SOR' : 'NOT';
  item.obj.matchedSorDescription = match.matchedSorDescription;
});

// Rebuild the array with updated items
const updatedItems = items.map(item => {
  // Convert object to JSON string with proper formatting
  return JSON.stringify(item.obj, null, 2);
}).join(',\n  ');

// Reconstruct the file
const beforeArray = content.substring(0, arrayStart + 1);
const afterArray = content.substring(arrayEnd);

const newContent = beforeArray + '\n  ' + updatedItems + '\n  ' + afterArray;

// Remove the old post-processing code if it exists
const postProcStart = newContent.indexOf('// Post-process inventory items');
if (postProcStart !== -1) {
  const postProcEnd = newContent.indexOf('});', postProcStart) + 3;
  const cleanContent = newContent.substring(0, postProcStart) + newContent.substring(postProcEnd);
  fs.writeFileSync(filePath, cleanContent.trim() + '\n', 'utf-8');
} else {
  fs.writeFileSync(filePath, newContent.trim() + '\n', 'utf-8');
}

console.log(`\nInventory updated successfully!`);
console.log(`Total items: ${items.length}`);
console.log(`SOR items: ${sorCount}`);
console.log(`NOT items: ${notCount}`);
console.log(`\nFile written to: ${filePath}`);
