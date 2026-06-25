import fs from 'fs';

const rawData = JSON.parse(fs.readFileSync('extracted_raw.json', 'utf8'));

const unitCandidates = new Set();

for (const [file, text] of Object.entries(rawData)) {
  // Regex to find things between a long description and a quantity/rate block
  // Example: "Some long text Kilometre 10 45226.00"
  const matches = text.match(/[a-zA-Z]{3,15}\s+\d+\s+[\d.]{5,}/g);
  if (matches) {
    matches.forEach(m => {
      const parts = m.split(/\s+/);
      unitCandidates.add(parts[0]);
    });
  }
}

console.log('Unit candidates found:', Array.from(unitCandidates).sort());
