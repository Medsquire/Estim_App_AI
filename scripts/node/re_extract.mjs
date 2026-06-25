import * as pdfjs from './coreui/node_modules/pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(path.resolve('./coreui/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')).href;

const UPLOADS_DIR = './coreui/uploads';
const files = [
  'LOA ABSS.pdf',
  'SOR 2024.pdf',
  'STTC.pdf',
  'zonal2024_loa.pdf'
];

async function extractTextFromPdf(filePath) {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const pdf = await pdfjs.getDocument({ data }).promise;
  let fullText = '';
  const numPages = filePath.includes('SOR 2024') ? Math.min(pdf.numPages, 10) : pdf.numPages;

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    fullText += textContent.items.map(item => item.str).join(' ') + '\n';
  }
  return fullText;
}

async function main() {
  const results = {};
  for (const file of files) {
    console.log(`Extracting ${file}...`);
    results[file] = await extractTextFromPdf(path.join(UPLOADS_DIR, file));
  }
  fs.writeFileSync('extracted_raw.json', JSON.stringify(results, null, 2));
}

main().catch(console.error);
