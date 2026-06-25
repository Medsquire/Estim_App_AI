import json
import re
from pathlib import Path

source_path = Path(r"d:\Ajay_project\core_UI\coreui\Json\SOR\SOR.json")
output_path = Path(r"d:\Ajay_project\core_UI\coreui\uploads\SOR_files\SOR_2024_all_items_428.json")

raw = source_path.read_text(encoding="utf-8")

# Tolerant cleanup for non-strict JSON edits
cleaned = re.sub(r"/\*.*?\*/", "", raw, flags=re.S)
cleaned = re.sub(r"//.*", "", cleaned)
cleaned = re.sub(r"(\})(\s*\"\d+\"\s*:)", r"\1,\2", cleaned)
cleaned = re.sub(r",\s*([}\]])", r"\1", cleaned)

parsed = json.loads(cleaned)

flattened = []
for chapter_key, chapter_data in (parsed.get("chapters") or {}).items():
    chapter_num = int(chapter_key) if str(chapter_key).isdigit() else chapter_key
    for item in chapter_data.get("items", []):
        item_no = str(item.get("item_no", "")).strip()
        desc = str(item.get("description", "")).strip()
        sub_items = item.get("sub_items") if isinstance(item.get("sub_items"), list) else []

        if sub_items:
            for sub in sub_items:
                variant = str(sub.get("variant", "")).strip()
                full_no = f"{item_no} {variant}".strip()
                flattened.append(
                    {
                        "item_no": full_no,
                        "description": desc,
                        "unit": str(sub.get("unit", "")).strip(),
                        "rate": sub.get("rate"),
                        "chapter": chapter_num,
                    }
                )
        else:
            flattened.append(
                {
                    "item_no": item_no,
                    "description": desc,
                    "unit": str(item.get("unit", "")).strip(),
                    "rate": item.get("rate"),
                    "chapter": chapter_num,
                }
            )

# Keep only well-formed entries with rate
flattened = [
    x for x in flattened
    if x.get("item_no") and x.get("description") and x.get("unit") and isinstance(x.get("rate"), (int, float))
]

output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text(json.dumps(flattened, indent=2, ensure_ascii=False), encoding="utf-8")

print(f"Source: {source_path}")
print(f"Output: {output_path}")
print(f"Flattened item count: {len(flattened)}")
