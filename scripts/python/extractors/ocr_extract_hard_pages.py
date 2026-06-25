import json
import re
from pathlib import Path
from collections import OrderedDict
import pdfplumber
from PIL import Image
import io
import numpy as np
from paddleocr import PaddleOCR

PDF_PATH = Path(r'd:\Ajay_project\core_UI\coreui\uploads\SOR_files\SOR 2024.pdf')
JSON_PATH = Path(r'd:\Ajay_project\core_UI\coreui\Json\SOR\SOR_Upadted.json')

with JSON_PATH.open('r', encoding='utf-8') as f:
    data = json.load(f, object_pairs_hook=OrderedDict)

chapters = data['chapters']
hard_chapters = {'39', '46', '47'}
hard_pages = {39: 73, 46: 89, 47: 96}  # chapter -> page number

print("Initializing PaddleOCR (English)...")
ocr = PaddleOCR(use_angle_cls=True, lang='en', use_gpu=False)

def clean_text(s: str) -> str:
    s = (s or '').replace('\n', ' ').replace('\r', ' ')
    s = re.sub(r'\s+', ' ', s).strip()
    return s.strip()

def extract_tables_with_ocr(pdf_path, page_num):
    """Extract table content using OCR from a specific page"""
    with pdfplumber.open(str(pdf_path)) as pdf:
        page = pdf.pages[page_num - 1]
        
        # Convert page to image
        im = page.to_image(resolution=300)
        img_array = np.array(im.original)
        
        # Apply OCR
        print(f"  Applying OCR to page {page_num}...")
        result = ocr.ocr(img_array, cls=True)
        
        # Extract text with coordinates
        items_extracted = {}
        for line in result:
            if not line:
                continue
            for word_info in line:
                text = word_info[1][0]
                confidence = word_info[1][1]
                if confidence < 0.5:
                    continue
                
                # Try to match item patterns
                item_match = re.match(r'^(\d{3,4})\s*\(([a-zA-Z])\)\s*(.+)$', text.strip())
                if item_match:
                    item_no = f"{item_match.group(1)} ({item_match.group(2).lower()})"
                    description = clean_text(item_match.group(3))
                    items_extracted[item_no] = {
                        'desc_fragment': description,
                        'confidence': confidence
                    }
        
        return items_extracted

# Extract from hard pages
ocr_extracted = {}
for ch_num, page_num in hard_pages.items():
    print(f"\nExtracting Chapter {ch_num} (page {page_num})...")
    items = extract_tables_with_ocr(str(PDF_PATH), page_num)
    for item_no, data in items.items():
        ocr_extracted[(str(ch_num), item_no)] = data['desc_fragment']
    print(f"  Extracted {len(items)} item descriptions from chapter {ch_num}")

print(f"\nTotal items extracted via OCR: {len(ocr_extracted)}")

# Now use OCR results to improve existing descriptions
updated_count = 0
for (ch_key, item_no_str), ocr_desc in ocr_extracted.items():
    if ocr_desc and len(ocr_desc) > 10:
        for item in chapters[ch_key].get('items', []):
            if str(item['item_no']) == item_no_str:
                current_desc = str(item.get('description', '')).strip()
                # If OCR found something longer or different, use it
                if len(ocr_desc) > len(current_desc) * 0.8:
                    item['description'] = ocr_desc
                    updated_count += 1
                break

with JSON_PATH.open('w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write('\n')

print(f"\nDescriptions updated via OCR: {updated_count}")
print("SOR_Upadted.json updated successfully!")
