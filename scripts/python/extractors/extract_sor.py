import pdfplumber
import json
from pathlib import Path

def extract_sor_items():
    """Extract ITEM No, ITEM, unit, Rate from SOR 2024.pdf"""
    pdf_path = r"d:\Ajay_project\core_UI\coreui\uploads\pdf\SOR 2024.pdf"
    
    all_items = []
    
    with pdfplumber.open(pdf_path) as pdf:
        print(f"Processing: {pdf_path}")
        print(f"Total pages: {len(pdf.pages)}\n")
        
        for page_num, page in enumerate(pdf.pages, 1):
            tables = page.extract_tables()
            
            if tables:
                print(f"Page {page_num}: Found {len(tables)} table(s)")
                
                for table_num, table in enumerate(tables, 1):
                    print(f"  Table {table_num}:")
                    
                    # Try to identify headers
                    if len(table) > 0:
                        headers = table[0]
                        print(f"    Headers: {headers}")
                        
                        # Find column indices for our required fields
                        item_no_idx = None
                        item_idx = None
                        unit_idx = None
                        rate_idx = None
                        
                        # Search for column indices (case-insensitive)
                        for idx, header in enumerate(headers):
                            if header:
                                h_lower = str(header).lower().strip()
                                if 'item' in h_lower and 'no' in h_lower:
                                    item_no_idx = idx
                                elif h_lower == 'item' or h_lower.startswith('item'):
                                    if item_idx is None:  # Take first 'item' that's not 'item no'
                                        item_idx = idx
                                elif 'unit' in h_lower:
                                    unit_idx = idx
                                elif 'rate' in h_lower:
                                    rate_idx = idx
                        
                        # If we found at least some columns, process the data rows
                        if any([item_no_idx is not None, item_idx is not None, 
                               unit_idx is not None, rate_idx is not None]):
                            
                            for row_num, row in enumerate(table[1:], 1):  # Skip header row
                                item_obj = {}
                                
                                # Extract values safely
                                if item_no_idx is not None and item_no_idx < len(row):
                                    item_obj['ITEM No'] = row[item_no_idx]
                                
                                if item_idx is not None and item_idx < len(row):
                                    item_obj['ITEM'] = row[item_idx]
                                
                                if unit_idx is not None and unit_idx < len(row):
                                    item_obj['unit'] = row[unit_idx]
                                
                                if rate_idx is not None and rate_idx < len(row):
                                    item_obj['Rate'] = row[rate_idx]
                                
                                # Only add if we have at least some data
                                if item_obj:
                                    item_obj['page'] = page_num
                                    item_obj['table'] = table_num
                                    all_items.append(item_obj)
    
    return all_items

# Run extraction
print("=" * 70)
print("SOR 2024 PDF EXTRACTION")
print("=" * 70 + "\n")

items = extract_sor_items()

print(f"\n\nTotal items extracted: {len(items)}\n")

# Display first few items
print("=" * 70)
print("FIRST 10 ITEMS")
print("=" * 70)
if items:
    for i, item in enumerate(items[:10], 1):
        print(f"\n{i}. {item}")
else:
    print("No items found")

# Save to JSON
output_path = r"d:\Ajay_project\core_UI\coreui\extracted_sor_items.json"
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(items, f, indent=2, ensure_ascii=False)

print(f"\n\n✓ Extraction complete!")
print(f"✓ Total items: {len(items)}")
print(f"✓ Output saved to: extracted_sor_items.json")
