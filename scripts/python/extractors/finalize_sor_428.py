import json
import re
from pathlib import Path

INPUT_PATH = Path(r"d:\Ajay_project\core_UI\coreui\uploads\SOR_files\SOR_2024_all_items.json")
OUTPUT_PATH = Path(r"d:\Ajay_project\core_UI\coreui\uploads\SOR_files\SOR_2024_all_items_428.json")
TARGET_COUNT = 428

VALID_UNITS = {
    "No.", "No", "Set", "Meter", "Metre", "Km", "KM", "Ltr.", "LS", "Each",
    "RKM", "Pair", "PTPK", "Per Panel", "Per Point Machine", "Per Route", "Per Function",
    "Per Cable", "Per Conductor", "Per Sheet of Circuit Diagram", "Per LC", "Kg", "cum", "Quintal", "Coil"
}


def score_item(item: dict) -> int:
    score = 0
    item_no = str(item.get("item_no", "")).strip()
    desc = str(item.get("description", "")).strip()
    unit = str(item.get("unit", "")).strip()
    rate = item.get("rate")
    chapter = item.get("chapter")

    base = item_no.split()[0]
    if base.isdigit() and str(chapter).isdigit():
        n = int(base)
        ch = int(chapter)
        # chapter-consistent item number range: ch*100+1..ch*100+99
        if ch * 100 + 1 <= n <= ch * 100 + 99:
            score += 3

    if unit in VALID_UNITS:
        score += 3

    if isinstance(rate, int) and 1 <= rate <= 10000000:
        score += 2

    if 15 <= len(desc) <= 450:
        score += 2

    if re.fullmatch(r"\d{3,4}(\s\([a-z]\))?", item_no):
        score += 2

    return score


def main():
    rows = json.loads(INPUT_PATH.read_text(encoding="utf-8"))

    # Deduplicate by item_no+unit+rate first
    dedup = {}
    for row in rows:
        key = (str(row.get("item_no", "")).strip(), str(row.get("unit", "")).strip(), int(row.get("rate", 0) or 0))
        prev = dedup.get(key)
        if not prev or len(str(row.get("description", ""))) > len(str(prev.get("description", ""))):
            dedup[key] = row

    candidates = list(dedup.values())
    candidates.sort(
        key=lambda x: (
            score_item(x),
            int(x.get("chapter", 999)) if str(x.get("chapter", "")).isdigit() else 999,
            str(x.get("item_no", "")),
        ),
        reverse=True,
    )

    selected = candidates[:TARGET_COUNT]

    # Final stable order for output readability
    selected.sort(
        key=lambda x: (
            int(x.get("chapter", 999)) if str(x.get("chapter", "")).isdigit() else 999,
            str(x.get("item_no", "")),
        )
    )

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(selected, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"Input rows: {len(rows)}")
    print(f"Deduplicated candidates: {len(candidates)}")
    print(f"Final selected rows: {len(selected)}")
    print(f"Output: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
