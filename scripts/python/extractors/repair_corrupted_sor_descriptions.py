import json
import re
from pathlib import Path

import pdfplumber


ROOT = Path(r"d:/Ajay_project/core_UI/coreui")
UPDATED_PATH = ROOT / "Json" / "SOR" / "SOR_Upadted.json"
PDF_PATH = ROOT / "uploads" / "SOR_files" / "SOR 2024.pdf"

CHAPTER_STARTS = {
    3: 9,
    34: 65,
    36: 67,
    37: 71,
    38: 72,
    40: 79,
    41: 80,
    42: 82,
    44: 85,
    45: 86,
    46: 89,
    47: 96,
}

CORRUPTION_MARKERS = (
    "Signature valid",
    "Digitally sig",
    "Dy.CSTE",
    "Oy.CSTE",
    "CHINTALAPATI",
)


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def dump_json(path: Path, data: dict) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def clean_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text or "").strip()
    text = re.sub(r"\s+([,.;:)])", r"\1", text)
    text = re.sub(r"([(])\s+", r"\1", text)
    return text.strip()


def is_corrupted(description: str) -> bool:
    desc = str(description or "")
    return any(marker in desc for marker in CORRUPTION_MARKERS)


def group_page_lines(page: pdfplumber.page.Page):
    words = page.extract_words(x_tolerance=2, y_tolerance=2, keep_blank_chars=False)
    filtered = [word for word in words if word["x0"] < 540 and word["top"] < 730]
    filtered.sort(key=lambda word: (word["top"], word["x0"]))

    lines = []
    current = []
    current_top = None
    for word in filtered:
        if current_top is None or abs(word["top"] - current_top) <= 3:
            current.append(word)
            current_top = word["top"] if current_top is None else (current_top + word["top"]) / 2
        else:
            lines.append(sorted(current, key=lambda entry: entry["x0"]))
            current = [word]
            current_top = word["top"]
    if current:
        lines.append(sorted(current, key=lambda entry: entry["x0"]))
    return lines


def split_columns(words) -> tuple[str, str, str, str]:
    item = []
    description = []
    unit = []
    rate = []
    for word in words:
        x0 = word["x0"]
        text = word["text"]
        if x0 < 110:
            item.append(text)
        elif x0 < 430:
            description.append(text)
        elif x0 < 495:
            unit.append(text)
        else:
            rate.append(text)
    return clean_text(" ".join(item)), clean_text(" ".join(description)), clean_text(" ".join(unit)), clean_text(" ".join(rate))


def parse_chapter_items(pdf: pdfplumber.PDF, chapter: int, start_page: int, end_page: int) -> dict[str, str]:
    parsed = {}
    current_item = None
    current_parts = []
    current_main = None
    current_prefix = ""

    def finalize():
        nonlocal current_item, current_parts
        if current_item and current_parts:
            parsed[current_item] = clean_text(" ".join(current_parts))
        current_item = None
        current_parts = []

    for page_no in range(start_page, end_page + 1):
        page = pdf.pages[page_no - 1]
        for words in group_page_lines(page):
            item_text, desc_text, unit_text, rate_text = split_columns(words)
            line_text = clean_text(" ".join(word["text"] for word in words))

            if not line_text:
                continue
            if "DESCRIPTION OF THE ITEM" in line_text or line_text.startswith("ITEM") or line_text.startswith("No."):
                continue
            if re.search(rf"CHAPTER\s*[-—]?\s*{chapter}\b", line_text, re.I):
                continue

            full_item = re.fullmatch(r"(\d{3,4})\s*\(([a-z])\)", item_text, re.I)
            base_item = re.fullmatch(r"(\d{3,4})", item_text)
            variant_only = re.fullmatch(r"\(([a-z])\)", item_text, re.I)

            if full_item:
                finalize()
                current_main = full_item.group(1)
                current_item = f"{current_main} ({full_item.group(2).lower()})"
                current_parts = [desc_text] if desc_text else []
                current_prefix = ""
                continue

            if base_item:
                finalize()
                current_main = base_item.group(1)
                current_item = current_main
                current_parts = [desc_text] if desc_text else []
                current_prefix = desc_text
                continue

            if variant_only and current_main:
                finalize()
                current_item = f"{current_main} ({variant_only.group(1).lower()})"
                merged = clean_text(f"{current_prefix} {desc_text}") if current_prefix else desc_text
                current_parts = [merged] if merged else []
                continue

            if current_item and desc_text:
                current_parts.append(desc_text)

    finalize()
    return parsed


def main() -> None:
    data = load_json(UPDATED_PATH)
    chapter_order = sorted(CHAPTER_STARTS)
    chapter_ranges = {}
    for index, chapter in enumerate(chapter_order):
        start_page = CHAPTER_STARTS[chapter]
        end_page = 97 if index == len(chapter_order) - 1 else CHAPTER_STARTS[chapter_order[index + 1]] - 1
        chapter_ranges[chapter] = (start_page, end_page)

    parsed_by_chapter = {}
    with pdfplumber.open(str(PDF_PATH)) as pdf:
        for chapter, (start_page, end_page) in chapter_ranges.items():
            parsed_by_chapter[str(chapter)] = parse_chapter_items(pdf, chapter, start_page, end_page)

    replacements = 0
    for chapter_key, chapter in data["chapters"].items():
        if int(chapter_key) not in CHAPTER_STARTS:
            continue
        parsed = parsed_by_chapter.get(chapter_key, {})
        for item in chapter.get("items", []):
            item_no = str(item["item_no"])
            current_desc = str(item.get("description", "")).strip()
            parsed_desc = parsed.get(item_no)
            if not parsed_desc:
                continue
            should_replace = (
                is_corrupted(current_desc)
                or "..." in current_desc
                or len(parsed_desc) > len(current_desc) + 20
            )
            if should_replace and parsed_desc != current_desc:
                item["description"] = parsed_desc
                replacements += 1

    dump_json(UPDATED_PATH, data)

    remaining = []
    for chapter_key, chapter in data["chapters"].items():
        for item in chapter.get("items", []):
            desc = str(item.get("description", ""))
            if is_corrupted(desc):
                remaining.append((chapter_key, item["item_no"]))

    print("replacements", replacements)
    print("remaining_corrupted", len(remaining))
    for chapter_key, item_no in remaining[:20]:
        print("remaining", chapter_key, item_no)
    for chapter_key, item_no in [("36", "3601"), ("46", "4601"), ("46", "4604"), ("47", "4704")]:
        item = next(entry for entry in data["chapters"][chapter_key]["items"] if entry["item_no"] == item_no)
        print(f"sample {chapter_key} {item_no}: {item['description'][:220]}")


if __name__ == "__main__":
    main()
import json
import re
from collections import defaultdict
from pathlib import Path

import numpy as np
import pdfplumber
from paddleocr import PaddleOCR


ROOT = Path(r"d:/Ajay_project/core_UI/coreui")
UPDATED_PATH = ROOT / "Json" / "SOR" / "SOR_Upadted.json"
BASELINE_PATH = ROOT / "Json" / "SOR" / "SOR.json"
PDF_PATH = ROOT / "uploads" / "SOR_files" / "SOR 2024.pdf"

CORRUPTION_MARKERS = (
    "Signature valid",
    "Digitally signe",
    "Digitally sig",
    "Dy.CSTE",
    "Oy.CSTE",
    "CHINTALAPATI",
    "TA RAJU PRATAP",
)


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def is_corrupted(description: str) -> bool:
    desc = str(description or "")
    return any(marker in desc for marker in CORRUPTION_MARKERS)


def build_item_map(data: dict) -> dict:
    mapping = {}
    for ch_key, chapter in data["chapters"].items():
        for item in chapter.get("items", []):
            mapping[(str(ch_key), str(item["item_no"]))] = item
    return mapping


def find_table_chapter_pages(pdf_path: Path, wanted_chapters: set[str]) -> dict[str, int]:
    starts = {}
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page_no, page in enumerate(pdf.pages, 1):
            if page_no < 5 or page_no > 97:
                continue
            text = page.extract_text() or ""
            if "DESCRIPTION OF THE ITEM" not in text:
                continue
            for chapter in wanted_chapters:
                if chapter in starts:
                    continue
                if re.search(rf"CHAPTER\s*[-—]?\s*{re.escape(chapter)}\b", text, re.I):
                    starts[chapter] = page_no
    return starts


def raster_ocr_page(ocr: PaddleOCR, pdf_path: Path, page_no: int) -> str:
    with pdfplumber.open(str(pdf_path)) as pdf:
        page = pdf.pages[page_no - 1]
        rendered = page.to_image(resolution=170)
        image = np.array(rendered.original)
    result = ocr.ocr(image, cls=True)
    lines = []
    for block in result or []:
        for item in block or []:
            text = item[1][0].strip()
            confidence = float(item[1][1])
            if confidence >= 0.45 and text:
                lines.append(text)
    return "\n".join(lines)


def main() -> None:
    updated = load_json(UPDATED_PATH)
    baseline = load_json(BASELINE_PATH)

    updated_map = build_item_map(updated)
    baseline_map = build_item_map(baseline)

    corrupted_keys = []
    by_chapter = defaultdict(list)
    for key, item in updated_map.items():
        if is_corrupted(item.get("description", "")):
            corrupted_keys.append(key)
            by_chapter[key[0]].append(key[1])

    replacements = 0
    missing_baseline = []
    for key in corrupted_keys:
        baseline_item = baseline_map.get(key)
        updated_item = updated_map[key]
        if not baseline_item:
            missing_baseline.append(key)
            continue
        baseline_desc = str(baseline_item.get("description", "")).strip()
        if not baseline_desc or is_corrupted(baseline_desc):
            missing_baseline.append(key)
            continue
        updated_item["description"] = baseline_desc
        replacements += 1

    with UPDATED_PATH.open("w", encoding="utf-8") as handle:
        json.dump(updated, handle, indent=2, ensure_ascii=False)
        handle.write("\n")

    remaining = [
        key for key, item in updated_map.items() if is_corrupted(item.get("description", ""))
    ]

    affected_chapters = set(by_chapter)
    chapter_starts = find_table_chapter_pages(PDF_PATH, affected_chapters)

    ocr = PaddleOCR(lang="en")
    ocr_validation = {}
    for chapter in sorted(affected_chapters, key=int):
        page_no = chapter_starts.get(chapter)
        if not page_no:
            ocr_validation[chapter] = {"page": None, "snippet": "chapter page not found"}
            continue
        text = raster_ocr_page(ocr, PDF_PATH, page_no)
        snippet_lines = [line for line in text.splitlines() if line.strip()][:8]
        ocr_validation[chapter] = {
            "page": page_no,
            "snippet": " | ".join(snippet_lines[:4]),
        }

    print("corrupted_before", len(corrupted_keys))
    print("replacements", replacements)
    print("remaining_corrupted", len(remaining))
    if missing_baseline:
        print("missing_baseline", len(missing_baseline))
        for ch_key, item_no in missing_baseline[:20]:
            print("missing", ch_key, item_no)
    print("ocr_validation_pages")
    for chapter in sorted(ocr_validation, key=int):
        info = ocr_validation[chapter]
        print(f"chapter {chapter}: page {info['page']}: {info['snippet']}")


if __name__ == "__main__":
    main()