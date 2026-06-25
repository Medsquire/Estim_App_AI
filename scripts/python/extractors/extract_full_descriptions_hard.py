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
hard_pages = {39: 73, 46: 89, 47: 96}

def clean_text(s: str) -> str:
    s = (s or '').replace('\n', ' ').replace('\r', ' ')
    s = re.sub(r'\s+', ' ', s).strip()
    return s.strip()

extracted_descriptions = {}

with pdfplumber.open(str(PDF_PATH)) as pdf:
    for ch_num, page_no in hard_pages.items():
        print(f"\nExtracting Chapter {ch_num} from page {page_no}...")
        page = pdf.pages[page_no - 1]
        
        text = page.extract_text() or ''
        lines = text.split('\n')
        
        # Find all item patterns and capture their full descriptions
        i = 0
        while i < len(lines):
            line = clean_text(lines[i])
            
            # Match item number patterns: "3901", "4601", "4701", etc.
            # Sometimes with variant: "3901 (a)" or just "3901"
            item_match = re.match(r'^(\d{3,4})\s*(?:\(([a-zA-Z])\))?(?:\s+(.+))?$', line)
            
            if item_match:
                item_no_base = item_match.group(1)
                variant = item_match.group(2)
                initial_desc = item_match.group(3) or ''
                
                # Build item number with variant if present
                if variant:
                    item_no = f"{item_no_base} ({variant.lower()})"
                else:
                    item_no = item_no_base
                
                # Collect description from this line and subsequent lines
                full_desc_parts = [initial_desc] if initial_desc else []
                
                # Look ahead for continuation lines (until next item or rate)
                j = i + 1
                max_lines = 15  # Reasonable limit for multi-line descriptions
                line_count = 0
                
                while j < len(lines) and line_count < max_lines:
                    next_line = clean_text(lines[j])
                    
                    if not next_line:
                        j += 1
                        continue
                    
                    # Stop if we hit a new item (starts with 4 digits)
                    if re.match(r'^\d{3,4}', next_line):
                        break
                    
                    # Stop if we hit a rate (all digits and commas)
                    if re.fullmatch(r'^[\d,\.]+$', next_line):
                        break
                    
                    # Stop if we hit headers or special keywords
                    if re.search(r'CHAPTER|UNIT|Rate|No\.|ITEM.*DESCRIPTION|Signature|Digitally', next_line, re.I):
                        break
                    
                    # Add this line to description
                    full_desc_parts.append(next_line)
                    j += 1
                    line_count += 1
                
                # Combine all parts into full description
                full_desc = clean_text(' '.join(p for p in full_desc_parts if p))
                
                if full_desc and len(full_desc) > 10:
                    key = (str(ch_num), item_no)
                    extracted_descriptions[key] = full_desc
                    print(f"  {item_no}: {full_desc[:80]}...")
                
                i = j if j > i + 1 else i + 1
            else:
                i += 1

print(f"\nTotal items extracted from hard pages: {len(extracted_descriptions)}")

# Apply to JSON
updated_count = 0
for (ch_key, item_no_str), new_desc in extracted_descriptions.items():
    if new_desc and len(new_desc) > 10:
        for item in chapters[ch_key].get('items', []):
            if str(item['item_no']) == item_no_str:
                old_desc = str(item.get('description', '')).strip()
                
                # Only update if significantly different or longer
                if len(new_desc) > len(old_desc) or (new_desc != old_desc and len(new_desc) > len(old_desc) * 0.8):
                    item['description'] = new_desc
                    updated_count += 1
                    print(f"Updated: {ch_key}/{item_no_str}")
                break

with JSON_PATH.open('w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write('\n')

print(f"\nTotal descriptions updated: {updated_count}")
print("Remapping complete!")
