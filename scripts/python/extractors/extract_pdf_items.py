import pdfplumber
import json

def extract_items_from_pdf(pdf_path):
    """Extract all items from tables in a PDF file"""
    all_items = []
    
    with pdfplumber.open(pdf_path) as pdf:
        print(f"Processing: {pdf_path}")
        print(f"Total pages: {len(pdf.pages)}")
        
        for page_num, page in enumerate(pdf.pages, 1):
            tables = page.extract_tables()
            if tables:
                print(f"  Page {page_num}: Found {len(tables)} table(s)")
                for table_num, table in enumerate(tables, 1):
                    for row in table:
                        all_items.append({
                            'page': page_num,
                            'table': table_num,
                            'row': row
                        })
    
    return all_items

# Extract from both PDFs
pdf1 = r"D:\core_UI\coreui\tests\EST 2.0 (2).pdf"
pdf2 = r"D:\core_UI\coreui\tests\EST 3.0 (2).pdf"

print("=" * 60)
print("EST 2.0 Extraction")
print("=" * 60)
items_est2 = extract_items_from_pdf(pdf1)
print(f"Total rows extracted: {len(items_est2)}\n")

print("=" * 60)
print("EST 3.0 Extraction")
print("=" * 60)
items_est3 = extract_items_from_pdf(pdf2)
print(f"Total rows extracted: {len(items_est3)}\n")

# Display results
print("\n" + "=" * 60)
print("EST 2.0 Items")
print("=" * 60)
if items_est2:
    for i, item in enumerate(items_est2[:10], 1):  # Show first 10 items
        print(f"\nRow {i} (Page {item['page']}, Table {item['table']}):")
        print(f"  {item['row']}")
else:
    print("No items found")

print("\n" + "=" * 60)
print("EST 3.0 Items")
print("=" * 60)
if items_est3:
    for i, item in enumerate(items_est3[:10], 1):  # Show first 10 items
        print(f"\nRow {i} (Page {item['page']}, Table {item['table']}):")
        print(f"  {item['row']}")
else:
    print("No items found")

# Save full data to JSON for review
with open('extracted_items.json', 'w', encoding='utf-8') as f:
    json.dump({
        'est2': items_est2,
        'est3': items_est3
    }, f, indent=2, ensure_ascii=False)

print("\n\nFull data saved to extracted_items.json")
