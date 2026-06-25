import pdfplumber
import json
import re

pdf_path = r"d:\Ajay_project\core_UI\coreui\uploads\pdf\SOR 2024.pdf"

def extract_all_items_comprehensive():
    """Comprehensive extraction - get all items from all pages"""
    all_items = []
    pages_with_items = {}
    
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
            if len(table) < 3:
                continue
            
            page_items = 0
            current_main_item = None
            
            for row_idx, row in enumerate(table):
                # Ensure we have at least basic columns
                if len(row) < 2:
                    continue
                
                # Get column values safely
                item_no = str(row[0]).strip() if row[0] else ''
                rate = str(row[9]).strip() if len(row) > 9 and row[9] else ''
                unit = str(row[8]).strip() if len(row) > 8 and row[8] else ''
                
                # Merge description columns (1-7)
                desc_parts = []
                for i in range(1, 8):
                    if i < len(row) and row[i]:
                        desc_parts.append(str(row[i]).strip())
                description = ' '.join(desc_parts)
                
                # Check if this is a main item (numeric)
                if re.match(r'^[\d]{2,3}$', item_no):
                    current_main_item = item_no
                    
                    # Add main item
                    if rate and rate.isdigit():
                        item_obj = {
                            'ITEM No': item_no,
                            'ITEM': description if description else 'See variants',
                            'unit': unit if unit else 'No.',
                            'Rate': rate
                        }
                        all_items.append(item_obj)
                        page_items += 1
                
                # Check if this is a sub-item
                elif re.match(r'^\([a-z]\)$', item_no) and current_main_item:
                    if rate and rate.isdigit():
                        item_obj = {
                            'ITEM No': f"{current_main_item} {item_no}",
                            'ITEM': description,
                            'unit': unit if unit else 'No.',
                            'Rate': rate
                        }
                        all_items.append(item_obj)
                        page_items += 1
                
                # Handle items that might be numbered like 201, 301, etc with more text after
                elif re.match(r'^[\d]{2,3}[.]?[\d]?', item_no):
                    if rate and rate.isdigit():
                        item_obj = {
                            'ITEM No': item_no,
                            'ITEM': description if description else 'Item',
                            'unit': unit if unit else 'No.',
                            'Rate': rate
                        }
                        all_items.append(item_obj)
                        page_items += 1
                        current_main_item = item_no
            
            if page_items > 0:
                pages_with_items[page_num] = page_items
                print(f"Page {page_num:3d}: {page_items:3d} items")
    
    print(f"\nPages with items: {len(pages_with_items)}")
    return all_items

# Run extraction
print("=" * 90)
print("SOR 2024 - COMPREHENSIVE ITEM EXTRACTION")
print("=" * 90 + "\n")

items = extract_all_items_comprehensive()

print(f"\n{'='*90}")
print(f"Total items extracted: {len(items)}")
print(f"{'='*90}\n")

# Save to JSON
output_path = r"d:\Ajay_project\core_UI\coreui\SOR_2024_items.json"
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(items, f, indent=2, ensure_ascii=False)

print(f"✓ Saved to: SOR_2024_items.json\n")

# Show sample items
print("SAMPLE ITEMS (First 20):\n")
for i, item in enumerate(items[:20], 1):
    print(f"{i:3d}. No: {item['ITEM No']:<15} Unit: {item['unit']:<8} Rate: {item['Rate']:<10}")
    print(f"     Item: {item['ITEM'][:70]}\n")
