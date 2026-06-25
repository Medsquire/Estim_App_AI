import pdfplumber
import json
import re

pdf_path = r"d:\Ajay_project\core_UI\coreui\uploads\pdf\SOR 2024.pdf"

def clean_and_merge(text_list):
    """Merge list of cells into single text, cleaning up"""
    if not text_list:
        return ""
    result = ' '.join(str(t).strip() for t in text_list if t and str(t).strip())
    return result.strip()

def extract_all_items():
    """Extract all items from SOR PDF"""
    all_items = []
    
    with pdfplumber.open(pdf_path) as pdf:
        print(f"Processing {len(pdf.pages)} pages...\n")
        
        for page_num, page in enumerate(pdf.pages, 1):
            tables = page.extract_tables(table_settings={
                "vertical_strategy": "text",
                "horizontal_strategy": "text",
            })
            
            if not tables:
                continue
            
            table = tables[0]
            if len(table) < 2:
                continue
            
            # Skip pages with no meaningful data (headers, TOC, etc.)
            # Item tables typically have 10+ columns and 5+ rows of data
            if len(table[0]) < 8:
                continue
            
            # Process rows (skip header rows)
            start_row = 0
            for i, row in enumerate(table[:3]):  # Check first 3 rows for header
                row_text = clean_and_merge(row).lower()
                if 'item' in row_text or 'description' in row_text or 'rate' in row_text:
                    start_row = i + 1
                    break
            
            # Skip chapter headers and process data rows
            for row_idx in range(start_row, len(table)):
                row = table[row_idx]
                
                if len(row) < 3:
                    continue
                
                # Clean row - join split cells
                # Typical structure: [ITEM No] [Description cols] [UNIT] [Rate]
                row_text = [clean_and_merge([c]) if c else '' for c in row]
                
                # Skip empty rows
                if not any(row_text):
                    continue
                
                # Try to identify item number (usually numeric or alphanumeric with parens)
                item_no = None
                item_desc = []
                unit = ''
                rate = ''
                
                # First column usually contains item number
                first_col = row_text[0].strip() if row_text else ''
                
                # Check if this looks like an item number
                if re.match(r'^[\d]+', first_col) or re.match(r'^\([a-z]\)', first_col):
                    item_no = first_col
                    # Rest of the description is in columns 1-7 typically
                    item_desc = [c.strip() for c in row_text[1:8] if c.strip()]
                    # Unit is usually around column 8
                    if len(row_text) > 8:
                        unit = row_text[8].strip()
                    # Rate is usually last column
                    if len(row_text) > 9:
                        rate = row_text[9].strip() if row_text[9] else row_text[-1].strip()
                
                # Only add if we have item number and rate
                if item_no and rate and rate != '':
                    item_obj = {
                        'ITEM No': item_no,
                        'ITEM': clean_and_merge(item_desc),
                        'unit': unit,
                        'Rate': rate,
                        'page': page_num
                    }
                    
                    # Validate the item
                    if item_obj['ITEM'] and len(item_obj['ITEM']) > 5:
                        all_items.append(item_obj)
    
    return all_items

# Run extraction
print("=" * 80)
print("SOR 2024 - EXTRACTING ITEMS (ITEM No, ITEM, unit, Rate)")
print("=" * 80 + "\n")

items = extract_all_items()

print(f"Total items extracted: {len(items)}\n")

if items:
    print("=" * 80)
    print("SAMPLE ITEMS (First 10)")
    print("=" * 80 + "\n")
    
    for i, item in enumerate(items[:10], 1):
        print(f"{i}. ITEM No: {item['ITEM No']}")
        print(f"   ITEM: {item['ITEM']}")
        print(f"   Unit: {item['unit']}")
        print(f"   Rate: {item['Rate']}")
        print(f"   Page: {item['page']}\n")
    
    # Save to JSON
    output_path = r"d:\Ajay_project\core_UI\coreui\SOR_2024_items.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(items, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Successfully extracted {len(items)} items")
    print(f"✓ Saved to: SOR_2024_items.json")
else:
    print("No items could be extracted with current logic.")
