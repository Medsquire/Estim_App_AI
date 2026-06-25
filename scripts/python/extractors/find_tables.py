import pdfplumber

pdf_path = r"d:\Ajay_project\core_UI\coreui\uploads\pdf\SOR 2024.pdf"

with pdfplumber.open(pdf_path) as pdf:
    # Check pages 6-15 where actual data should start
    for page_num in range(5, min(15, len(pdf.pages))):
        page = pdf.pages[page_num]
        tables = page.extract_tables()
        
        if tables and len(tables) > 0:
            print(f"\n{'='*70}")
            print(f"PAGE {page_num + 1} - FOUND TABLE!")
            print(f"{'='*70}")
            
            for t_idx, table in enumerate(tables, 1):
                print(f"\nTable {t_idx}: {len(table)} rows")
                
                # Show header and first few rows
                for row_idx in range(min(4, len(table))):
                    print(f"Row {row_idx}: {table[row_idx]}")
