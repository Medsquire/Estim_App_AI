import pdfplumber

pdf_path = r"d:\Ajay_project\core_UI\coreui\uploads\pdf\SOR 2024.pdf"

with pdfplumber.open(pdf_path) as pdf:
    print(f"Scanning all {len(pdf.pages)} pages for tables...\n")
    
    table_pages = []
    
    for page_num, page in enumerate(pdf.pages):
        tables = page.extract_tables()
        if tables and len(tables) > 0:
            table_pages.append(page_num + 1)
            print(f"Page {page_num + 1}: {len(tables)} table(s) found")
    
    if not table_pages:
        print("No tables found in any page!")
    else:
        print(f"\nPages with tables: {table_pages}")
        
        # Show details of first table found
        first_page = table_pages[0] - 1
        page = pdf.pages[first_page]
        tables = page.extract_tables()
        
        print(f"\n{'='*70}")
        print(f"FIRST TABLE FOUND (Page {first_page + 1})")
        print(f"{'='*70}")
        table = tables[0]
        print(f"Rows: {len(table)}, Columns: {len(table[0]) if table else 0}\n")
        
        # Show first 5 rows
        for row_idx in range(min(5, len(table))):
            print(f"Row {row_idx}: {table[row_idx]}")
