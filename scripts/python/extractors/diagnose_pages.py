import json
from pathlib import Path
import pdfplumber

PDF_PATH = Path(r'd:\Ajay_project\core_UI\coreui\uploads\SOR_files\SOR 2024.pdf')
JSON_PATH = Path(r'd:\Ajay_project\core_UI\coreui\Json\SOR\SOR_Upadted.json')

with JSON_PATH.open('r', encoding='utf-8') as f:
    data = json.load(f)

# Check current state of chapters 39, 46, 47
for ch_key in ['39', '46', '47']:
    items = data['chapters'][ch_key]['items']
    print(f"\nChapter {ch_key}: {len(items)} items")
    
    # Sample a few
    for i in range(min(3, len(items))):
        item = items[i]
        desc = item['description'][:80] if item.get('description') else 'NO DESC'
        print(f"  {item['item_no']}: {desc}...")

# Now check the PDF pages directly
with pdfplumber.open(str(PDF_PATH)) as pdf:
    hard_pages = {39: 73, 46: 89, 47: 96}
    
    for ch_num, page_no in hard_pages.items():
        print(f"\n\nPDF Page {page_no} (Chapter {ch_num}):")
        page = pdf.pages[page_no - 1]
        
        # Check tables
        tables = page.extract_tables()
        print(f"  Tables detected: {len(tables) if tables else 0}")
        if tables:
            for t_idx, table in enumerate(tables):
                print(f"    Table {t_idx}: {len(table)} rows")
                for row_idx, row in enumerate(table[:3]):
                    print(f"      Row {row_idx}: {[clean_text(c) for c in row[:2]]}")
        
        # Check raw text
        text = page.extract_text()
        lines = text.split('\n') if text else []
        print(f"  Raw text lines: {len(lines)}")
        print(f"  First 5 lines:")
        for line in lines[:5]:
            print(f"    {line[:100]}")

def clean_text(s):
    return (s or '').replace('\n', ' ')[:50]
