import json
import re
from pathlib import Path
from collections import OrderedDict
import pdfplumber

PDF_PATH = Path(r'd:\Ajay_project\core_UI\coreui\uploads\SOR_files\SOR 2024.pdf')
JSON_PATH = Path(r'd:\Ajay_project\core_UI\coreui\Json\SOR\SOR_Upadted.json')

with JSON_PATH.open('r', encoding='utf-8') as f:
    data = json.load(f, object_pairs_hook=OrderedDict)

chapters = data['chapters']

def get_truncated_items():
    items = {}
    for ch_key, ch in chapters.items():
        for item in ch.get('items', []):
            desc = str(item.get('description', '')).strip()
            if '...' in desc:
                items[(str(ch_key), str(item['item_no']))] = {
                    'old_desc': desc,
                    'rate': str(item.get('rate', '')).strip(),
                }
    return items

def clean_text(s: str) -> str:
    s = (s or '').replace('\n', ' ').replace('\r', ' ')
    s = re.sub(r'\s+', ' ', s).strip()
    return s.strip()

truncated = get_truncated_items()
print(f"Total truncated items to fix: {len(truncated)}")

# Strategy: Extract full page text from each page in the PDF and use simple search
extracted_full = {}

with pdfplumber.open(str(PDF_PATH)) as pdf:
    for page_no, page in enumerate(pdf.pages, 1):
        if page_no < 5 or page_no > 97:
            continue
        
        text = page.extract_text() or ''
        text = clean_text(text)
        
        # For each truncated item, search in this page text
        for (ch_key, item_no_str), item_data in truncated.items():
            if (ch_key, item_no_str) in extracted_full:
                continue  # Already found
            
            # Search for this item number in the page text
            patterns_to_try = [
                # Pattern: "123 (a) description ... rate"
                rf'\b{re.escape(item_no_str)}\s+\([a-zA-Z]\)\s+(.+?)(?=\b\d{{3,4}}\s+\(|$)',
                # Pattern: "(a) description ... rate" - if item already in text
                rf'\(\w\)\s+(.+?)(?:\b\d{{3,4}}\s+\(|$)',
            ]
            
            for pattern in patterns_to_try:
                try:
                    matches = list(re.finditer(pattern, text, re.DOTALL | re.IGNORECASE))
                    for match in matches:
                        extracted_text = clean_text(match.group(1))
                        # Check if it looks like a description (has letters, not too short)
                        if extracted_text and len(extracted_text) > 15 and any(c.isalpha() for c in extracted_text):
                            # Make sure it's not all numbers (rates)
                            if not re.fullmatch(r'[\d,\s\.]+', extracted_text):
                                extracted_full[(ch_key, item_no_str)] = extracted_text
                                break
                except Exception:
                    pass
                
                if (ch_key, item_no_str) in extracted_full:
                    break

print(f"Successfully extracted from PDF: {len(extracted_full)}")

# Now apply the extracted descriptions to the JSON
updated_count = 0
for (ch_key, item_no_str), new_desc in extracted_full.items():
    if new_desc and len(new_desc) > len(truncated.get((ch_key, item_no_str), {}).get('old_desc', '')):
        for item in chapters[ch_key].get('items', []):
            if str(item['item_no']) == item_no_str:
                item['description'] = new_desc
                updated_count += 1
                break

with JSON_PATH.open('w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write('\n')

# Count remaining truncated
remaining = sum(1 for ch in chapters.values() for item in ch.get('items', []) if '...' in str(item.get('description', '')))

print(f"Updated: {updated_count}")
print(f"Remaining truncated: {remaining}")
