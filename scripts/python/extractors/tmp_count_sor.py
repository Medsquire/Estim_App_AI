import json
import re
from pathlib import Path

p = Path(r"d:\Ajay_project\core_UI\coreui\Json\SOR\SOR.json")
s = p.read_text(encoding="utf-8")

# Fix known structural issue in chapter 41 block if present
s = s.replace(
    '{"item_no": "4102", "description": "Incremental rate for vital signalling functions...", "unit": "Per Function", "rate": 71250}\n    },\n    "42": {',
    '{"item_no": "4102", "description": "Incremental rate for vital signalling functions...", "unit": "Per Function", "rate": 71250}\n      ]\n    },\n    "42": {'
)

# Remove comments and trailing commas for tolerant JSON parsing
s = re.sub(r"/\*.*?\*/", "", s, flags=re.S)
s = re.sub(r"//.*", "", s)
s = re.sub(r",\s*([}\]])", r"\1", s)

j = json.loads(s)

total = 0
for _, chapter in (j.get("chapters") or {}).items():
    for item in chapter.get("items", []):
        sub_items = item.get("sub_items") if isinstance(item.get("sub_items"), list) else []
        if sub_items:
            total += len(sub_items)
        else:
            total += 1

print(total)
