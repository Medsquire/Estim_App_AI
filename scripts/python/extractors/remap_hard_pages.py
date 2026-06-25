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
hard_pages = [73, 89, 96]  # Chapters 39, 46, 47

def clean_text(s: str) -> str:
    s = (s or '').replace('\n', ' ').replace('\r', ' ').replace('—', '-')
    s = re.sub(r'\s+', ' ', s).strip()
    return s.strip()

# Extract table data using pdfplumber's table detection
extracted_descriptions = {}

with pdfplumber.open(str(PDF_PATH)) as pdf:
    for page_no in hard_pages:
        print(f"Processing page {page_no}...")
        page = pdf.pages[page_no - 1]
        
        # Try to extract tables
        tables = page.extract_tables()
        
        if tables:
            for table in tables:
                print(f"  Found table with {len(table)} rows")
                
                for row_idx, row in enumerate(table):
                    if not row or len(row) < 2:
                        continue
                    
                    # Row typically has: Item No | Description | Unit | Rate
                    cell_0 = clean_text(row[0]) if row[0] else ''
                    cell_1 = clean_text(row[1]) if len(row) > 1 and row[1] else ''
                    cell_2 = clean_text(row[2]) if len(row) > 2 and row[2] else ''
                    cell_3 = clean_text(row[3]) if len(row) > 3 and row[3] else ''
                    
                    # Check if this is an item row
                    item_match = re.match(r'^(\d{3,4})\s*\(([a-zA-Z])\)$', cell_0)
                    if item_match:
                        item_no = f"{item_match.group(1)} ({item_match.group(2).lower()})"
                        desc = cell_1
                        
                        # Handle multi-cell descriptions (sometimes split across cells)
                        if not desc and cell_2:
                            desc = cell_2
                        elif not desc and cell_3:
                            desc = cell_3
                        
                        if desc and len(desc) > 5:
                            # Determine chapter from page
                            if page_no == 73:
                                ch_key = '39'
                            elif page_no == 89:
                                ch_key = '46'
                            else:  # page_no == 96
                                ch_key = '47'
                            
                            extracted_descriptions[(ch_key, item_no)] = desc
                            print(f"    Found item {item_no}: {desc[:60]}...")
        
        # Also try raw text extraction for comparison
        text = page.extract_text() or ''
        lines = text.split('\n')
        
        # Look for item patterns in raw text
        for i, line in enumerate(lines):
            line_clean = clean_text(line)
            item_match = re.match(r'^(\d{3,4})\s*\(([a-zA-Z])\)\s+(.+)$', line_clean)
            if item_match:
                item_no = f"{item_match.group(1)} ({item_match.group(2).lower()})"
                desc = item_match.group(3)
                
                # Try to collect full description from next lines
                j = i + 1
                while j < len(lines) and j < i + 5:
                    next_line = clean_text(lines[j])
                    # Stop if we hit next item or rate
                    if re.match(r'^\d{3,4}\s*\(', next_line) or re.fullmatch(r'^[\d,\.]+$', next_line):
                        break
                    if next_line and not re.search(r'CHAPTER|UNIT|Rate|No\.', next_line, re.I):
                        desc = f"{desc} {next_line}"
                    j += 1
                
                if len(desc) > 20:
                    if page_no == 73:
                        ch_key = '39'
                    elif page_no == 89:
                        ch_key = '46'
                    else:
                        ch_key = '47'
                    
                    key = (ch_key, item_no)
                    if key not in extracted_descriptions or len(desc) > len(extracted_descriptions[key]):
                        extracted_descriptions[key] = desc

# Apply extracted descriptions to JSON
updated_count = 0
for (ch_key, item_no_str), new_desc in extracted_descriptions.items():
    if new_desc:
        for item in chapters[ch_key].get('items', []):
            if str(item['item_no']) == item_no_str:
                old_desc = str(item.get('description', '')).strip()
                # Update if new description is longer or significantly different
                if len(new_desc) > len(old_desc) * 0.8 and new_desc != old_desc:
                    item['description'] = new_desc
                    updated_count += 1
                    print(f"Updated Chapter {ch_key}, Item {item_no_str}")
                break

with JSON_PATH.open('w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write('\n')

print(f"\nTotal updated from hard pages: {updated_count}")
print("Remapping complete!")
