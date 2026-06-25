import pdfplumber
import json

pdf_path = r"d:\Ajay_project\core_UI\coreui\uploads\pdf\SOR 2024.pdf"

print("Looking for item data tables with ITEM No, ITEM, unit, Rate columns...\n")

with pdfplumber.open(pdf_path) as pdf:
    # Check pages starting from page 5 onwards for actual item data
    for page_num in range(4, min(20, len(pdf.pages))):
        page = pdf.pages[page_num]
        tables = page.extract_tables(table_settings={
            "vertical_strategy": "text",
            "horizontal_strategy": "text",
        })
        
        if tables:
            table = tables[0]
            
            # Check if this table has the item data headers
            if len(table) > 0:
                # Look for headers
                headers = table[0]
                header_text = ' '.join(str(h).lower() if h else '' for h in headers)
                
                # Check if this looks like an item table
                if any(keyword in header_text for keyword in ['item', 'unit', 'rate', 'no']):
                    print(f"\n{'='*80}")
                    print(f"PAGE {page_num + 1} - POTENTIAL ITEM DATA")
                    print(f"{'='*80}")
                    print(f"Row 0 (Headers): {headers}")
                    
                    # Show next few rows
                    for i in range(1, min(6, len(table))):
                        print(f"Row {i}: {table[i]}")
