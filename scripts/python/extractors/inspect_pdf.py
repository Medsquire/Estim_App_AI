import pdfplumber
import json

pdf_path = r"d:\Ajay_project\core_UI\coreui\uploads\pdf\SOR 2024.pdf"

with pdfplumber.open(pdf_path) as pdf:
    print(f"Total pages: {len(pdf.pages)}\n")
    
    # Check first 5 pages for table structure
    for page_num in range(min(5, len(pdf.pages))):
        page = pdf.pages[page_num]
        tables = page.extract_tables()
        
        print(f"\n{'='*70}")
        print(f"PAGE {page_num + 1}")
        print(f"{'='*70}")
        print(f"Number of tables found: {len(tables) if tables else 0}")
        
        if tables:
            for t_idx, table in enumerate(tables, 1):
                print(f"\nTable {t_idx}:")
                print(f"  Rows: {len(table)}")
                print(f"  Columns: {len(table[0]) if table else 0}")
                
                # Show header
                if len(table) > 0:
                    print(f"  Headers: {table[0]}")
                
                # Show first data row
                if len(table) > 1:
                    print(f"  First data row: {table[1]}")
        else:
            # If no tables, try text extraction
            text = page.extract_text()
            print(f"  No tables found. Text preview (first 500 chars):")
            print(f"  {text[:500] if text else 'No text'}")
