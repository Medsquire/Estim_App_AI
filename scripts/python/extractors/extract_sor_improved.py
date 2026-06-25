import pdfplumber
import json
import re

pdf_path = r"d:\Ajay_project\core_UI\coreui\uploads\pdf\SOR 2024.pdf"

def extract_items_improved():
    """Extract items with proper understanding of table structure"""
    all_items = []
    
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            tables = page.extract_tables(table_settings={
                "vertical_strategy": "text",
                "horizontal_strategy": "text",
            })
            
            if not tables:
                continue
            
            table = tables[0]
            if len(table) < 3:
                continue
            
            current_main_item = None
            current_main_description = None
            
            for row_idx, row in enumerate(table):
                if len(row) < 10:
                    continue
                
                # Get values from standard columns
                item_no = row[0].strip() if row[0] else ''
                desc_parts = [row[i].strip() for i in range(1, 8) if i < len(row) and row[i]]
                unit = row[8].strip() if len(row) > 8 and row[8] else ''
                rate = row[9].strip() if len(row) > 9 and row[9] else ''
                
                # Merge description parts
                description = ' '.join(desc_parts)
                
                # Check if this is a main item (starts with number like 101, 111, etc.)
                if re.match(r'^[\d]{2,3}$', item_no):
                    current_main_item = item_no
                    current_main_description = description
                    
                    # Add main item if it has a rate
                    if rate and rate.isdigit():
                        item_obj = {
                            'ITEM No': item_no,
                            'ITEM': description if description else 'See variants',
                            'unit': unit,
                            'Rate': rate
                        }
                        all_items.append(item_obj)
                
                # Check if this is a sub-item (starts with letter like (a), (b), etc.)
                elif re.match(r'^\([a-z]\)$', item_no) and current_main_item:
                    # This is a variant/sub-item of the current main item
                    if rate and (rate.isdigit() or rate.lower() in ['', 'no.', 'meter', 'm', 'kg', 'set']):
                        if rate and rate.isdigit():  # Only add if we have a numeric rate
                            variant_desc = description if description else f"Variant {item_no}"
                            item_obj = {
                                'ITEM No': f"{current_main_item} {item_no}",
                                'ITEM': variant_desc,
                                'unit': unit,
                                'Rate': rate
                            }
                            all_items.append(item_obj)
    
    return all_items

# Run extraction
print("=" * 90)
print("SOR 2024 - EXTRACTING ITEMS WITH IMPROVED LOGIC")
print("=" * 90 + "\n")

items = extract_items_improved()

print(f"Total items extracted: {len(items)}\n")

if items:
    print("=" * 90)
    print("SAMPLE ITEMS (First 20)")
    print("=" * 90 + "\n")
    
    for i, item in enumerate(items[:20], 1):
        print(f"{i:3d}. ITEM No: {item['ITEM No']:<15} | Unit: {item['unit']:<8} | Rate: {item['Rate']:<10} | ITEM: {item['ITEM'][:60]}")
    
    # Save to JSON
    output_path = r"d:\Ajay_project\core_UI\coreui\SOR_2024_items.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(items, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Successfully extracted {len(items)} items")
    print(f"✓ Saved to: SOR_2024_items.json")
else:
    print("No items could be extracted.")
