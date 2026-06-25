import json
import re
from pathlib import Path

import pdfplumber

PDF_PATH = Path(r"d:\Ajay_project\core_UI\coreui\uploads\SOR_files\SOR 2024.pdf")
OUTPUT_PATH = Path(r"d:\Ajay_project\core_UI\coreui\uploads\SOR_files\SOR_2024_all_items.json")


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip()


def parse_rate(value: str) -> str:
    if not value:
        return ""
    m = re.search(r"(\d[\d,]*)", value.replace(" ", ""))
    return m.group(1).replace(",", "") if m else ""


def parse_item_token(value: str) -> str:
    v = clean_text(value)
    if not v:
        return ""

    vm = re.match(r"^\(?([a-zA-Z])\)?$", v)
    if vm:
        return f"({vm.group(1).lower()})"

    m = re.match(r"^(\d{3,4})$", v)
    if m:
        return m.group(1)

    # Handles occasional prefixes like 'S 906'
    m2 = re.match(r"^[A-Za-z]\s*(\d{3,4})$", v)
    if m2:
        return m2.group(1)

    return ""


def emit(items, chapter, page, item_code, description, unit, rate):
    description = clean_text(description)
    unit = clean_text(unit)
    rate = parse_rate(rate)

    if not item_code or not description or not rate:
        return

    items.append(
        {
            "item_no": item_code,
            "description": description,
            "unit": unit if unit else "No.",
            "rate": int(rate),
            "chapter": chapter,
            "page": page,
        }
    )


def extract_items():
    if not PDF_PATH.exists():
        raise FileNotFoundError(f"PDF not found: {PDF_PATH}")

    items = []
    chapter_no = ""

    with pdfplumber.open(str(PDF_PATH)) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            tables = page.extract_tables(
                table_settings={
                    "vertical_strategy": "text",
                    "horizontal_strategy": "text",
                }
            )

            if not tables:
                continue

            current_main = ""
            main_desc = ""
            main_unit = ""
            main_rate = ""
            main_emitted = False

            current_variant = ""
            variant_desc = ""
            variant_unit = ""
            variant_rate = ""
            variant_emitted = False

            active_target = ""  # main|variant

            for table in tables:
                for row in table:
                    if not row:
                        continue

                    cols = [clean_text(c or "") for c in row]
                    if len(cols) < 2:
                        continue

                    token = parse_item_token(cols[0])
                    desc = clean_text(" ".join(cols[1:4]))
                    unit = cols[4] if len(cols) > 4 else ""
                    rate = cols[5] if len(cols) > 5 else ""

                    full_line = clean_text(" ".join(cols))
                    ch_match = re.search(r"CHAPTER\s*(\d{1,2})", full_line, re.IGNORECASE)
                    if ch_match:
                        chapter_no = ch_match.group(1)

                    # Skip obvious headers/noise lines
                    if re.search(r"\b(ITEM|DESCRIPTION|UNIT|RATE)\b", full_line, re.IGNORECASE) and not token:
                        continue

                    is_main = bool(re.match(r"^\d{3,4}$", token))
                    is_variant = bool(re.match(r"^\([a-z]\)$", token))
                    has_rate = bool(parse_rate(rate))

                    if is_main:
                        # Emit pending variant before switching
                        if current_variant and not variant_emitted:
                            emit(
                                items,
                                chapter_no,
                                page_num,
                                f"{current_main} {current_variant}",
                                variant_desc,
                                variant_unit,
                                variant_rate,
                            )

                        # Emit pending main before switching
                        if current_main and not main_emitted:
                            emit(items, chapter_no, page_num, current_main, main_desc, main_unit, main_rate)

                        current_main = token
                        main_desc = desc
                        main_unit = unit
                        main_rate = rate
                        main_emitted = False

                        current_variant = ""
                        variant_desc = ""
                        variant_unit = ""
                        variant_rate = ""
                        variant_emitted = False

                        active_target = "main"

                        if has_rate:
                            emit(items, chapter_no, page_num, current_main, main_desc, main_unit, main_rate)
                            main_emitted = True

                        continue

                    if is_variant and current_main:
                        if current_variant and not variant_emitted:
                            emit(
                                items,
                                chapter_no,
                                page_num,
                                f"{current_main} {current_variant}",
                                variant_desc,
                                variant_unit,
                                variant_rate,
                            )

                        current_variant = token
                        variant_desc = desc
                        variant_unit = unit
                        variant_rate = rate
                        variant_emitted = False
                        active_target = "variant"

                        if has_rate:
                            emit(
                                items,
                                chapter_no,
                                page_num,
                                f"{current_main} {current_variant}",
                                variant_desc,
                                variant_unit,
                                variant_rate,
                            )
                            variant_emitted = True

                        continue

                    # Continuation rows
                    if active_target == "variant" and current_variant:
                        if desc:
                            variant_desc = clean_text(f"{variant_desc} {desc}")
                        if unit:
                            variant_unit = unit
                        if rate:
                            variant_rate = rate
                        if parse_rate(variant_rate) and not variant_emitted:
                            emit(
                                items,
                                chapter_no,
                                page_num,
                                f"{current_main} {current_variant}",
                                variant_desc,
                                variant_unit,
                                variant_rate,
                            )
                            variant_emitted = True
                        continue

                    if active_target == "main" and current_main:
                        if desc:
                            main_desc = clean_text(f"{main_desc} {desc}")
                        if unit:
                            main_unit = unit
                        if rate:
                            main_rate = rate
                        if parse_rate(main_rate) and not main_emitted:
                            emit(items, chapter_no, page_num, current_main, main_desc, main_unit, main_rate)
                            main_emitted = True

            # End-of-page flush
            if current_variant and not variant_emitted:
                emit(
                    items,
                    chapter_no,
                    page_num,
                    f"{current_main} {current_variant}",
                    variant_desc,
                    variant_unit,
                    variant_rate,
                )
            if current_main and not main_emitted:
                emit(items, chapter_no, page_num, current_main, main_desc, main_unit, main_rate)

    # Deduplicate by item_no+unit+rate (keep longest description)
    dedup = {}
    for it in items:
        key = (it["item_no"], it["unit"], it["rate"])
        prev = dedup.get(key)
        if not prev or len(it["description"]) > len(prev["description"]):
            dedup[key] = it

    final_items = sorted(dedup.values(), key=lambda x: (x["chapter"], x["item_no"]))
    return final_items


def main():
    extracted = extract_items()

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(extracted, f, indent=2, ensure_ascii=False)

    print(f"PDF: {PDF_PATH}")
    print(f"Extracted items: {len(extracted)}")
    print(f"Output: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
