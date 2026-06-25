import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile

import pdfplumber


DOCX_PATH = Path(r"d:/Ajay_project/core_UI/coreui/uploads/SOR_files/Final Copy SCR SOR 2024 Supply & Labour.docx")
PDF_PATH = Path(r"d:/Ajay_project/core_UI/coreui/uploads/SOR_files/SOR 2024.pdf")
OUTPUT_PATH = Path(r"d:/Ajay_project/core_UI/coreui/Json/SOR/SOR_WORD.json")

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
PDF_START_PAGE = 4
PDF_END_PAGE = 97


def clean_text(value: str) -> str:
    value = value or ""
    value = value.replace("\u2019", "'").replace("\u2018", "'")
    value = value.replace("\u201c", '"').replace("\u201d", '"')
    value = value.replace("\u2013", "-").replace("\u2014", "-")
    value = value.replace("\xa0", " ")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def paragraph_text(element: ET.Element) -> str:
    return clean_text("".join(node.text or "" for node in element.findall(".//w:t", NS)))


def parse_rate(value: str):
    text = clean_text(value).replace(",", "")
    if not text:
        return None
    if re.fullmatch(r"\d+", text):
        return int(text)
    if re.fullmatch(r"\d+\.\d+", text):
        return float(text)
    return text


def parse_toc_table(tables: list[ET.Element]) -> dict[str, dict[str, int | str]]:
    chapter_info: dict[str, dict[str, int | str]] = {}
    for table in tables:
        rows = table.findall("w:tr", NS)
        if len(rows) < 3:
            continue
        header_cells = [paragraph_text(tc) for tc in rows[1].findall("w:tc", NS)]
        if len(header_cells) < 4 or header_cells[:4] != ["Sl.No.", "CHAPTER", "DESCRIPTION", "Page No"]:
            continue
        for row in rows[2:]:
            cells = [paragraph_text(tc) for tc in row.findall("w:tc", NS)]
            if len(cells) < 4:
                continue
            chapter_match = re.search(r"CHAPTER\s*[- ]\s*(\d+)", cells[1], re.I)
            page_match = re.search(r"\d+", cells[3])
            if not chapter_match or not page_match:
                continue
            chapter_no = chapter_match.group(1)
            chapter_info[chapter_no] = {
                "name": clean_text(cells[2]),
                "start_page": int(page_match.group()),
            }
        break
    if not chapter_info:
        raise RuntimeError("Unable to locate the chapter index table in the DOCX source.")
    chapter_numbers = list(chapter_info.keys())
    for index, chapter_no in enumerate(chapter_numbers):
        start_page = int(chapter_info[chapter_no]["start_page"])
        if index + 1 < len(chapter_numbers):
            next_start = int(chapter_info[chapter_numbers[index + 1]]["start_page"])
            end_page = max(start_page, next_start - 1)
        else:
            end_page = PDF_END_PAGE
        chapter_info[chapter_no]["end_page"] = end_page
    return chapter_info


def build_pdf_index() -> tuple[dict[int, str], dict[str, dict[str, int | str]]]:
    pdf_text_by_page: dict[int, str] = {}
    chapter_pages: dict[str, dict[str, int | str]] = {}
    ordered_chapters: list[str] = []
    with pdfplumber.open(str(PDF_PATH)) as pdf:
        for file_page_no in range(PDF_START_PAGE, min(PDF_END_PAGE, len(pdf.pages)) + 1):
            text = clean_text(pdf.pages[file_page_no - 1].extract_text() or "")
            pdf_text_by_page[file_page_no] = text
            chapter_match = re.search(r"CHAPTER\s*(\d+)\s*[-\u2013\u2014]", text, re.I)
            if chapter_match:
                chapter_no = chapter_match.group(1)
                if chapter_no not in chapter_pages:
                    ordered_chapters.append(chapter_no)
                    page_number_match = re.match(r"(\d{1,3})\b", text)
                    printed_page = int(page_number_match.group(1)) if page_number_match else file_page_no
                    chapter_pages[chapter_no] = {
                        "file_start_page": file_page_no,
                        "printed_start_page": printed_page,
                    }
    for index, chapter_no in enumerate(ordered_chapters):
        current = chapter_pages[chapter_no]
        if index + 1 < len(ordered_chapters):
            next_start = int(chapter_pages[ordered_chapters[index + 1]]["file_start_page"])
            current["file_end_page"] = next_start - 1
        else:
            current["file_end_page"] = PDF_END_PAGE
    return pdf_text_by_page, chapter_pages


def iter_item_tables(body: ET.Element) -> list[ET.Element]:
    tables: list[ET.Element] = []
    for child in list(body):
        tag = child.tag.rsplit("}", 1)[-1]
        if tag != "tbl":
            continue
        rows = child.findall("w:tr", NS)
        if not rows:
            continue
        header = [paragraph_text(tc) for tc in rows[0].findall("w:tc", NS)]
        if len(header) >= 4 and header[:4] == ["ITEMNo.", "DESCRIPTION OF THE ITEM", "UNIT", "Rate₹"]:
            tables.append(child)
    return tables


def description_hint(description: str) -> list[str]:
    words = re.findall(r"[A-Za-z0-9]+", description.lower())
    return [word for word in words if len(word) > 3][:8]


def locate_page(
    chapter_no: str,
    item_no: str,
    description: str,
    chapter_pages: dict[str, dict[str, int | str]],
    pdf_text_by_page: dict[int, str],
) -> int | None:
    info = chapter_pages.get(chapter_no)
    if not info:
        return None
    start_page = int(info["file_start_page"])
    end_page = int(info["file_end_page"])
    base_match = re.match(r"(\d+)", item_no)
    if not base_match:
        return int(info.get("printed_start_page", start_page))
    base_no = base_match.group(1)
    variant_match = re.search(r"\(([a-z])\)", item_no, re.I)
    variant = variant_match.group(1).lower() if variant_match else None
    hint_words = description_hint(description)

    best_page = None
    best_score = -1
    for page_no in range(start_page, end_page + 1):
        page_text = pdf_text_by_page.get(page_no, "")
        if base_no not in page_text:
            continue
        score = 1
        if variant and re.search(rf"\({variant}\)", page_text, re.I):
            score += 3
        score += sum(1 for word in hint_words if word in page_text.lower())
        if score > best_score:
            best_score = score
            best_page = page_no
    resolved_page = best_page or start_page
    page_text = pdf_text_by_page.get(resolved_page, "")
    page_number_match = re.match(r"(\d{1,3})\b", page_text)
    if page_number_match:
        return int(page_number_match.group(1))
    return resolved_page


def extract_items() -> dict:
    with ZipFile(DOCX_PATH) as archive:
        xml = archive.read("word/document.xml")
    root = ET.fromstring(xml)
    body = root.find("w:body", NS)
    if body is None:
        raise RuntimeError("Unable to locate the DOCX body.")

    all_tables = body.findall("w:tbl", NS)
    chapter_info = parse_toc_table(all_tables)
    item_tables = iter_item_tables(body)
    pdf_text_by_page, chapter_pages = build_pdf_index()

    chapters: dict[str, dict] = {}
    current_chapter = None
    base_no = None
    base_desc = ""
    preface_parts: list[str] = []
    last_item = None

    for table in item_tables:
        rows = table.findall("w:tr", NS)[1:]
        for row in rows:
            cells = [paragraph_text(tc) for tc in row.findall("w:tc", NS)]
            while len(cells) < 4:
                cells.append("")
            item_cell, desc_cell, unit_cell, rate_cell = [clean_text(cell) for cell in cells[:4]]

            chapter_match = re.match(r"CHAPTER\s*(\d+)\s*[-\u2013]\s*(.+)", item_cell or desc_cell, re.I)
            if chapter_match:
                current_chapter = chapter_match.group(1)
                chapter_name = clean_text(chapter_match.group(2))
                chapter_meta = chapter_info.get(current_chapter, {})
                chapters.setdefault(
                    current_chapter,
                    {
                        "name": chapter_name or chapter_meta.get("name", ""),
                        "start_page": chapter_meta.get("start_page") or chapter_pages.get(current_chapter, {}).get("printed_start_page"),
                        "end_page": chapter_meta.get("end_page") or chapter_pages.get(current_chapter, {}).get("file_end_page"),
                        "items": [],
                    },
                )
                if not chapters[current_chapter]["name"]:
                    chapters[current_chapter]["name"] = chapter_name
                base_no = None
                base_desc = ""
                preface_parts = []
                last_item = None
                continue

            if current_chapter is None:
                continue

            item_list = chapters[current_chapter]["items"]
            row_is_blank = not any([item_cell, desc_cell, unit_cell, rate_cell])
            if row_is_blank:
                continue

            direct_variant = re.match(r"^(\d+)\s*\(([a-z])\)$", item_cell, re.I)
            direct_item = re.match(r"^(\d+)$", item_cell)
            suffix_variant = re.match(r"^\(([a-z])\)$", item_cell, re.I)

            if direct_variant:
                base_no = direct_variant.group(1)
                variant = direct_variant.group(2).lower()
                full_description = clean_text(" ".join(part for part in [base_desc] + preface_parts + [desc_cell] if part))
                item_list.append(
                    {
                        "item_no": f"{base_no} ({variant})",
                        "description": full_description,
                        "unit": unit_cell,
                        "rate": parse_rate(rate_cell),
                        "chapter": int(current_chapter),
                    }
                )
                preface_parts = []
                last_item = item_list[-1]
                continue

            if direct_item:
                base_no = direct_item.group(1)
                base_desc = clean_text(" ".join(preface_parts + [desc_cell]))
                preface_parts = []
                if unit_cell or rate_cell:
                    item_list.append(
                        {
                            "item_no": base_no,
                            "description": base_desc,
                            "unit": unit_cell,
                            "rate": parse_rate(rate_cell),
                            "chapter": int(current_chapter),
                        }
                    )
                    last_item = item_list[-1]
                else:
                    last_item = None
                continue

            if suffix_variant:
                variant = suffix_variant.group(1).lower()
                if not base_no:
                    continue
                full_description = clean_text(" ".join(part for part in [base_desc, desc_cell] if part))
                item_list.append(
                    {
                        "item_no": f"{base_no} ({variant})",
                        "description": full_description,
                        "unit": unit_cell,
                        "rate": parse_rate(rate_cell),
                        "chapter": int(current_chapter),
                    }
                )
                last_item = item_list[-1]
                continue

            if not item_cell:
                if desc_cell and not unit_cell and not rate_cell:
                    if last_item is not None:
                        last_item["description"] = clean_text(f"{last_item['description']} {desc_cell}")
                    elif base_no and base_desc:
                        base_desc = clean_text(f"{base_desc} {desc_cell}")
                    else:
                        preface_parts.append(desc_cell)
                elif desc_cell and (unit_cell or rate_cell) and base_no:
                    item_list.append(
                        {
                            "item_no": base_no,
                            "description": clean_text(" ".join(preface_parts + [desc_cell])),
                            "unit": unit_cell,
                            "rate": parse_rate(rate_cell),
                            "chapter": int(current_chapter),
                        }
                    )
                    preface_parts = []
                    last_item = item_list[-1]
                continue

            if desc_cell:
                preface_parts.append(clean_text(" ".join(part for part in [item_cell, desc_cell] if part)))
            else:
                preface_parts.append(item_cell)

    for chapter_no, chapter in chapters.items():
        for item in chapter["items"]:
            item["page_no"] = locate_page(
                chapter_no,
                item["item_no"],
                item["description"],
                chapter_pages,
                pdf_text_by_page,
            )

    return {
        "document": "South Central Railway Signal & Telecommunication Schedule of Rates 2024",
        "source": DOCX_PATH.name,
        "chapters": chapters,
    }


def main() -> None:
    data = extract_items()
    OUTPUT_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    chapter_count = len(data["chapters"])
    item_count = sum(len(chapter["items"]) for chapter in data["chapters"].values())
    print("chapters", chapter_count)
    print("items", item_count)
    print("output", OUTPUT_PATH)


if __name__ == "__main__":
    main()