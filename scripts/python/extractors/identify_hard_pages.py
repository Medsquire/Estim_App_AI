import json
import re
from pathlib import Path
from collections import OrderedDict
import pdfplumber
from PIL import Image
import io

PDF_PATH = Path(r'd:\Ajay_project\core_UI\coreui\uploads\SOR_files\SOR 2024.pdf')
JSON_PATH = Path(r'd:\Ajay_project\core_UI\coreui\Json\SOR\SOR_Upadted.json')

with JSON_PATH.open('r', encoding='utf-8') as f:
    data = json.load(f, object_pairs_hook=OrderedDict)

# Find which pages contain chapters 39, 46, 47
hard_chapters = {'39', '46', '47'}
page_ranges = {}

with pdfplumber.open(str(PDF_PATH)) as pdf:
    current_chapter = None
    chapter_start_page = None
    
    for page_no, page in enumerate(pdf.pages, 1):
        if page_no < 5 or page_no > 97:
            continue
        
        text = page.extract_text() or ''
        
        # Look for chapter markers
        ch_match = re.search(r'CHAPTER\s*(\d{1,2})', text, re.I)
        if ch_match:
            ch_num = ch_match.group(1)
            if ch_num in hard_chapters:
                if ch_num not in page_ranges:
                    page_ranges[ch_num] = {'start': page_no, 'end': page_no}
                else:
                    page_ranges[ch_num]['end'] = page_no
            current_chapter = ch_num

print("Page ranges for problematic chapters:")
for ch in sorted(hard_chapters):
    if ch in page_ranges:
        pr = page_ranges[ch]
        print(f"  Chapter {ch}: pages {pr['start']} - {pr['end']}")
