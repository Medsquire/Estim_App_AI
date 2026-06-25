const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const path = require('path');

async function extractText() {
    const loadingTask = pdfjsLib.getDocument('uploads/LOA_files/LOA of PCEE, PFA & PSCTE works (1).pdf');
    const pdf = await loadingTask.promise;
    console.log('PDF Loaded, pages:', pdf.numPages);

    for (let i = 1; i <= Math.min(pdf.numPages, 15); i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const strings = textContent.items.map(item => item.str);
        const fullText = strings.join(' ');
        if (fullText.toLowerCase().includes('item') || fullText.toLowerCase().includes('breakup')) {
            console.log('--- Page ' + i + ' ---');
            // Try to print items 1-20 or first few lines to see format
            console.log(fullText.substring(0, 3000));
        }
    }
}

extractText().catch(err => console.error(err));
