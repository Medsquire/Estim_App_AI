import pdfplumber
import json

pdf_path = r"d:\Ajay_project\core_UI\coreui\uploads\pdf\SOR 2024.pdf"

with pdfplumber.open(pdf_path) as pdf:
    # Check page 7 in detail
    page = pdf.pages[6]  # Page 7 (0-indexed)
    tables = page.extract_tables(table_settings={
        "vertical_strategy": "text",
        "horizontal_strategy": "text",
    })
    
    if tables:
        table = tables[0]
        print(f"PAGE 7 - Full table structure\n")
        print(f"Total rows: {len(table)}")
        print(f"Total columns: {len(table[0]) if table else 0}\n")
        
        # Print all rows with proper formatting
        for row_idx in range(min(25, len(table))):
            row = table[row_idx]
            print(f"Row {row_idx}:")
            for col_idx, cell in enumerate(row):
                if cell and str(cell).strip():
                    print(f"  Col {col_idx}: '{cell}'")
            print()
