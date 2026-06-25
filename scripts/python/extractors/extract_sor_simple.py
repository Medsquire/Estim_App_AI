import pdfplumber
import json

pdf_path = r"d:\Ajay_project\core_UI\coreui\uploads\pdf\SOR 2024.pdf"

print("Extracting with aggressive table detection...\n")

all_items = []

with pdfplumber.open(pdf_path) as pdf:
    for page_num, page in enumerate(pdf.pages, 1):
        # Try multiple table detection strategies
        tables = page.extract_tables(table_settings={
            "vertical_strategy": "lines_strict",
            "horizontal_strategy": "lines_strict",
        })
        
        if not tables:
            # Try with more relaxed settings
            tables = page.extract_tables(table_settings={
                "vertical_strategy": "text",
                "horizontal_strategy": "text",
            })
        
        if tables:
            print(f"Page {page_num}: Found {len(tables)} table(s)")
            for t_idx, table in enumerate(tables, 1):
                print(f"  Table {t_idx}: {len(table)} rows")
                
                if len(table) > 0:
                    all_items.extend(table)

print(f"\nTotal rows/items found: {len(all_items)}")

if all_items:
    print("\nFirst 5 items:")
    for i, item in enumerate(all_items[:5]):
        print(f"  {i+1}. {item}")
    
    # Save to JSON
    with open('sor_extracted_raw.json', 'w', encoding='utf-8') as f:
        json.dump(all_items, f, indent=2, ensure_ascii=False)
    print("\nSaved to sor_extracted_raw.json")
else:
    print("\nNo tables found. The PDF might be scanned/image-based.")
