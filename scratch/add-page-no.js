const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'app', 'views', 'estimations', 'work-details', 'inventory-data.ts');
let content = fs.readFileSync(filePath, 'utf8');

const pageMap = {
  LOA_ABSS: { A: 3, B: 4, C: 5, D: 8, E: 10, F: 16, G: 18, defaultPage: 3 },
  STTC: { A: 3, B: 4, C: 5, D: 3, E: 7, F: 8, G: 9, defaultPage: 3 },
  ZONAL_2024: { A: 3, B: 4, C: 5, D: 6, E: 7, F: 8, G: 9, defaultPage: 3 },
  SOR_2024: { defaultPage: 3 }
};

function getDocType(reference) {
  if (!reference) return 'SOR_2024';
  if (reference.includes('00850890090468')) return 'LOA_ABSS';
  if (reference.includes('01052610112449')) return 'STTC';
  if (reference.includes('01052610118677')) return 'ZONAL_2024';
  return 'SOR_2024';
}

function getPage(docType, schedule) {
  const docMap = pageMap[docType] || pageMap.SOR_2024;
  if (schedule && docMap[schedule]) return docMap[schedule];
  return docMap.defaultPage || 3;
}

let updated = 0;

content = content.replace(/\{[\s\S]*?\}/g, (obj) => {
  if (!/"schedule"\s*:\s*"[A-Z]"/.test(obj)) return obj;
  if (/"page_no"\s*:\s*\d+/.test(obj)) return obj;

  const referenceMatch = obj.match(/"reference"\s*:\s*"([^"]*)"/);
  const scheduleMatch = obj.match(/"schedule"\s*:\s*"([A-Z])"/);

  const reference = referenceMatch ? referenceMatch[1] : '';
  const schedule = scheduleMatch ? scheduleMatch[1] : '';

  const docType = getDocType(reference);
  const pageNo = getPage(docType, schedule);

  const replaced = obj.replace(
    /(\"schedule\"\s*:\s*\"[A-Z]\",\r?\n)(\s*)/,
    `$1$2\"page_no\": ${pageNo},\n$2`
  );

  if (replaced !== obj) updated += 1;
  return replaced;
});

fs.writeFileSync(filePath, content, 'utf8');
console.log(`Inserted page_no into ${updated} objects`);
