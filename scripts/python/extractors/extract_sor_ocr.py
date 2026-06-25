import pdfplumber
from pdf2image import convert_from_path
import pytesseract
import json
import re
import os

pdf_path = r"d:\Ajay_project\core_UI\coreui\uploads\pdf\SOR 2024.pdf"

# First, try pdfplumber with aggressive settings
def extract_with_pdfplumber():
    print("Attempting extraction with pdfplumber (advanced settings)...")
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
                print(f"  Page {page_num}: Found {len(tables)} tables")
                for table in tables:
                    all_items.extend(table)
    
    return all_items

# Try the extraction
print(f"Extracting from: {pdf_path}\n")
items = extract_with_pdfplumber()

if items:
    print(f"Found {len(items)} items")
    for i, item in enumerate(items[:5]):
        print(f"  {i+1}. {item}")
else:
    print("No tables found with pdfplumber")
    print("\nThe PDF appears to be scanned/image-based.")
    print("For OCR extraction, please install: pip install pytesseract pdf2image")
    print("Also install Tesseract-OCR from: https://github.com/UB-Mannheim/tesseract/wiki")
