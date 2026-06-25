import json
import re
from pathlib import Path

SRC = Path(r"d:\Ajay_project\core_UI\coreui\src\assets\converted\SOR_2024.json")
OUT = Path(r"d:\Ajay_project\core_UI\coreui\uploads\SOR_files\SOR_2024_all_items.json")

UNITS = {
    "No.", "No", "Set", "Meter", "Metre", "Km", "KM", "Ltr.", "LS", "Each",
    "RKM", "Pair", "PTPK", "Per Panel", "Per Point Machine", "Per Route", "Per Function",
    "Per Cable", "Per Conductor", "Per Sheet of Circuit Diagram", "Per LC", "Kg", "cum", "Quintal", "Coil"
}


def clean(x: str) -> str:
    return re.sub(r"\s+", " ", (x or "")).strip()


def is_main_token(x: str) -> bool:
    return bool(re.fullmatch(r"\d{3,4}", x))


def is_variant_token(x: str) -> bool:
    return bool(re.fullmatch(r"\([a-zA-Z]\)", x))


def is_rate(x: str) -> bool:
    return bool(re.fullmatch(r"\d{2,9}", x))


def is_header_row(cells: list[str]) -> bool:
    joined = " ".join(cells).upper()
    return (
        "DESCRIPTION OF THE ITEM" in joined
        or ("ITEM" in joined and "UNIT" in joined and "RATE" in joined)
        or joined.startswith("CHAPTER")
    )


def main():
    pages = json.loads(SRC.read_text(encoding="utf-8"))

    items = []
    chapter = ""
    current_main = ""
    active_item_no = ""
    active_desc_parts: list[str] = []

    # Expected extraction range for SOR rates
    start_page = 5
    end_page = 96

    for page_no, rows in enumerate(pages, 1):
        if page_no < start_page or page_no > end_page:
            continue
        if not isinstance(rows, list):
            continue

        for row in rows:
            if not isinstance(row, list):
                continue
            cells = [clean(str(c)) for c in row if clean(str(c))]
            if not cells:
                continue

            joined = " ".join(cells)
            ch = re.search(r"CHAPTER\s*-?\s*(\d{1,2})", joined, re.IGNORECASE)
            if ch:
                chapter = ch.group(1)

            if is_header_row(cells):
                continue

            # Find token/rate/unit anchors
            main_idx = next((i for i, c in enumerate(cells) if is_main_token(c)), None)
            var_idx = next((i for i, c in enumerate(cells) if is_variant_token(c)), None)
            rate_idx = None
            for i in range(len(cells) - 1, -1, -1):
                if is_rate(cells[i]):
                    rate_idx = i
                    break

            token_idx = main_idx if main_idx is not None else var_idx
            token_val = cells[token_idx] if token_idx is not None else ""

            if main_idx is not None:
                current_main = token_val
                active_item_no = current_main
                active_desc_parts = []
            elif var_idx is not None and current_main:
                active_item_no = f"{current_main} ({token_val[1].lower()})"
                active_desc_parts = []

            # capture description from non-anchor cells
            desc_parts = []
            for i, c in enumerate(cells):
                if i == token_idx or i == rate_idx:
                    continue
                if c in UNITS:
                    continue
                if is_rate(c):
                    continue
                if c.upper() in {"ITEM", "NO.", "UNIT", "RATE"}:
                    continue
                if re.fullmatch(r"[S.\-•]+", c):
                    continue
                desc_parts.append(c)

            if active_item_no and desc_parts:
                active_desc_parts.extend(desc_parts)

            # emit when rate and unit exist
            if active_item_no and rate_idx is not None:
                rate = int(cells[rate_idx])
                unit = ""

                # Search nearest unit left of rate
                for i in range(rate_idx - 1, -1, -1):
                    if cells[i] in UNITS:
                        unit = cells[i]
                        break

                if unit:
                    desc = clean(" ".join(active_desc_parts))
                    if desc and chapter:
                        items.append(
                            {
                                "item_no": active_item_no,
                                "description": desc,
                                "unit": unit,
                                "rate": rate,
                                "chapter": int(chapter),
                                "page": page_no,
                            }
                        )
                    active_desc_parts = []

    # Deduplicate
    dedup = {}
    for it in items:
        key = (it["item_no"], it["unit"], it["rate"])
        prev = dedup.get(key)
        if not prev or len(it["description"]) > len(prev["description"]):
            dedup[key] = it

    final_items = sorted(dedup.values(), key=lambda x: (x["chapter"], x["item_no"]))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(final_items, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"Source: {SRC}")
    print(f"Output: {OUT}")
    print(f"Extracted items: {len(final_items)}")


if __name__ == "__main__":
    main()
