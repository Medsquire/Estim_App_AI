import json
import re
from pathlib import Path

import pdfplumber

PDF_PATH = Path(r"d:\Ajay_project\core_UI\coreui\uploads\SOR_files\SOR 2024.pdf")
OUTPUT_PATH = Path(r"d:\Ajay_project\core_UI\coreui\uploads\SOR_files\SOR_2024_all_items.json")

UNITS = sorted(
    [
        "Per Sheet of Circuit Diagram",
        "Per Point Machine",
        "Per Function",
        "Per Conductor",
        "Per Cable",
        "Per Route",
        "Per Panel",
        "Per LC",
        "Per",
        "PTPK",
        "Quintal",
        "Meter",
        "Metre",
        "Ltr.",
        "RKM",
        "Each",
        "Pair",
        "Set",
        "No.",
        "No",
        "Km",
        "KM",
        "Kg",
        "LS",
        "cum",
        "Coil",
    ],
    key=len,
    reverse=True,
)


def clean(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()


def parse_tail(line: str):
    line = clean(line)
    m = re.search(r"(\d{2,9})$", line)
    if not m:
        return None
    rate = int(m.group(1))
    before = line[: m.start()].rstrip()
    for unit in UNITS:
        if before.endswith(" " + unit) or before == unit:
            desc = before[: -len(unit)].rstrip()
            return desc, unit, rate
    return None


def emit(items, item_no, desc, unit, rate, chapter, page):
    desc = clean(desc)
    unit = clean(unit)
    if not item_no or not desc or not unit or not isinstance(rate, int):
        return
    items.append(
        {
            "item_no": item_no,
            "description": desc,
            "unit": unit,
            "rate": rate,
            "chapter": chapter,
            "page": page,
        }
    )


def main():
    if not PDF_PATH.exists():
        raise FileNotFoundError(PDF_PATH)

    items = []
    chapter = ""
    current_main = ""
    active_kind = ""  # main|variant
    active_item_no = ""
    active_desc = ""

    with pdfplumber.open(str(PDF_PATH)) as pdf:
        for page_no, page in enumerate(pdf.pages, 1):
            if page_no < 5 or page_no > 96:
                continue

            text = page.extract_text() or ""
            for raw in text.splitlines():
                line = clean(raw)
                if not line:
                    continue

                ch = re.search(r"CHAPTER\s*(\d{1,2})", line, re.IGNORECASE)
                if ch:
                    chapter = ch.group(1)

                if re.search(r"ITEM\s+DESCRIPTION|DESCRIPTION OF THE ITEM|UNIT\s+Rate", line, re.IGNORECASE):
                    continue
                if re.fullmatch(r"\d{1,3}", line):
                    continue

                m_main = re.match(r"^(?:[A-Za-z]\s*)?(\d{3,4})\s+(.+)$", line)
                m_var = re.match(r"^\(([a-zA-Z])\)\s+(.+)$", line)

                if m_main:
                    current_main = m_main.group(1)
                    active_kind = "main"
                    active_item_no = current_main
                    active_desc = clean(m_main.group(2))

                    tail = parse_tail(active_desc)
                    if tail:
                        d, u, r = tail
                        emit(items, active_item_no, d, u, r, chapter, page_no)
                        active_desc = d
                    continue

                if m_var and current_main:
                    active_kind = "variant"
                    active_item_no = f"{current_main} ({m_var.group(1).lower()})"
                    active_desc = clean(m_var.group(2))

                    tail = parse_tail(active_desc)
                    if tail:
                        d, u, r = tail
                        emit(items, active_item_no, d, u, r, chapter, page_no)
                        active_desc = d
                    continue

                if active_kind and active_item_no:
                    merged = clean(f"{active_desc} {line}")
                    tail = parse_tail(merged)
                    if tail:
                        d, u, r = tail
                        emit(items, active_item_no, d, u, r, chapter, page_no)
                        active_desc = d
                    else:
                        active_desc = merged

    # dedupe by item_no + unit + rate (longest description wins)
    dedup = {}
    for it in items:
        key = (it["item_no"], it["unit"], it["rate"])
        prev = dedup.get(key)
        if not prev or len(it["description"]) > len(prev["description"]):
            dedup[key] = it

    final_items = list(dedup.values())
    final_items.sort(key=lambda x: (int(x["chapter"]) if str(x["chapter"]).isdigit() else 999, x["item_no"]))

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(final_items, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"PDF: {PDF_PATH}")
    print(f"Extracted items: {len(final_items)}")
    print(f"Output: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
