import fs from 'fs';
import path from 'path';

const filePath = path.join('src', 'app', 'views', 'estimations', 'work-details', 'inventory-data.ts');

// Since the file is UTF-16LE or UTF-8, let's read it keeping it safe. 
// fs.readFileSync will get buffer, let's try reading as 'utf16le' first to see if it matches.
let contentBuffer = fs.readFileSync(filePath);
let content = contentBuffer.toString('utf16le');
if (!content.includes('export const EXTRACTED_INVENTORY')) {
    // try utf8 fallback
    content = contentBuffer.toString('utf8');
}

// Find where the JSON array starts
const prefixMatch = content.match(/export\s+const\s+EXTRACTED_INVENTORY\s*=\s*\[/);
if (!prefixMatch) {
    console.error("Could not find the array start.");
    process.exit(1);
}

const prefix = content.substring(0, prefixMatch.index + prefixMatch[0].length - 1);
const jsonString = content.substring(prefixMatch.index + prefixMatch[0].length - 1);

let data;
try {
    data = JSON.parse(jsonString.replace(/;\s*$/, ''));
} catch (e) {
    console.error("Failed to parse JSON", e);
    process.exit(1);
}

// The valid units based on user prompt
const VALID_UNITS = ['Metre', 'Numbers', 'Set', 'Kilometre', 'RMT', 'Pairs', 'KM', 'Nos', 'Meters', 'Sets', 'Kg', 'Litre', 'Job', 'Month', 'Days', 'MT', 'Tonne'];

data.forEach(item => {
    if (item.unit) {
        let originalUnit = item.unit.trim();
        // Extract the last word
        let words = originalUnit.split(/\s+/);
        let lastWord = words[words.length - 1];

        // Some exact matches ignore case
        let cleanUnitMatch = VALID_UNITS.find(v => v.toLowerCase() === lastWord.toLowerCase());
        
        let validUnit = cleanUnitMatch || lastWord; // Default to last word if not in whitelist
        
        // Remove the unit word from the original string
        let remainingString = originalUnit.substring(0, originalUnit.lastIndexOf(lastWord)).trim();
        
        if (remainingString.length > 0) {
            // Append the remaining string back to the description
            item.description = (item.description + " " + remainingString).trim();
            // Clean up double spaces or bad punctuations
            item.description = item.description.replace(/\s{2,}/g, ' ');
        }
        item.unit = validUnit;
    }
});

const newContent = `${prefix}${JSON.stringify(data, null, 2)};\n`;

fs.writeFileSync(filePath, Buffer.from(newContent, 'utf8')); // write as standard utf8
console.log("Successfully cleaned units in inventory-data.ts!");
