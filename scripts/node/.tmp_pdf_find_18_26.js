const fs = require("fs");
(async () => {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const file = "src/assets/pdf/STTC.pdf";
  const data = new Uint8Array(fs.readFileSync(file));
  const doc = await pdfjs.getDocument({ data }).promise;
  const terms = [
    "schedule c",
    "view details",
    "at par",
    "above",
    "below",
    "bid rate",
    "bid amount",
    "26.19",
    "3293615.15"
  ];
  const lowerTerms = terms.map(t => t.toLowerCase());

  for (let p = 18; p <= 26; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const rows = new Map();

    for (const it of tc.items) {
      const s = (it.str || "").trim();
      if (!s) continue;
      const y = Math.round(it.transform[5]);
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push({ x: it.transform[4], s });
    }

    const orderedRows = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([y, arr]) => ({
        y,
        text: arr.sort((m, n) => m.x - n.x).map(v => v.s).join(" ")
      }));

    const matches = orderedRows.filter(r => {
      const line = r.text.toLowerCase();
      return lowerTerms.some(t => line.includes(t));
    });

    console.log(`=== Page ${p} ===`);
    if (matches.length === 0) {
      console.log("No matches");
      continue;
    }

    console.log(`Matches: ${matches.length}`);
    for (const r of matches) {
      const found = terms.filter(t => r.text.toLowerCase().includes(t.toLowerCase()));
      console.log(`y=${r.y} | terms=[${found.join(", ")}] | ${r.text}`);
    }
  }
})();
