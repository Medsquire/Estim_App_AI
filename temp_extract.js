const pdfjsLib = require('pdfjs-dist');

async function extractText() {
    const loadingTask = pdfjsLib.getDocument('uploads/LOA_files/LOA of PCEE, PFA & PSCTE works (1).pdf');
    const pdf = await loadingTask.promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
    }

    const anchors = ['Awarded Quantities And Rates', 'Item Breakup', 'Schedule A', 'Schedule D'];
    const items = ['1', '10', '58', '61'];

    console.log('--- Extractions ---');
    
    anchors.forEach(anchor => {
        const index = fullText.indexOf(anchor);
        if (index !== -1) {
            console.log('Anchor "' + anchor + '":');
            console.log(fullText.substring(Math.max(0, index - 50), Math.min(fullText.length, index + 200)));
            console.log('---');
        } else {
            console.log('Anchor "' + anchor + '" not found.');
        }
    });

    items.forEach(item => {
        const regex = new RegExp('(^|\\s)' + item + '\\b', 'g');
        let match;
        console.log('Item ' + item + ':');
        let found = false;
        while ((match = regex.exec(fullText)) !== null) {
            found = true;
            console.log(fullText.substring(Math.max(0, match.index - 50), Math.min(fullText.length, match.index + 200)));
            break;
        }
        if (!found) console.log('Item ' + item + ' not found.');
        console.log('---');
    });
}

extractText().catch(err => {
    console.error(err);
    process.exit(1);
});
