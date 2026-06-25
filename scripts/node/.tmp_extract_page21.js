const fs = require("fs");
(async () => {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(fs.readFileSync("src/assets/pdf/STTC.pdf"));
  const doc = await pdfjs.getDocument({ data }).promise;
  const page = await doc.getPage(21);
  const tc = await page.getTextContent();
  const rows = new Map();
  for (const it of tc.items) {
    const y = Math.round(it.transform[5]);
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push({ x: it.transform[4], s: (it.str || "").trim() });
  }
  const ordered = [...rows.entries()].sort((a,b)=>b[0]-a[0]).map(([y,arr])=>({ y, text: arr.sort((p,q)=>p.x-q.x).map(v=>v.s).filter(Boolean).join(" ") }));
  const needles = ["schedule", "view details", "at par", "above", "below", "bid", "amount", "26.19", "3293615.15"];
  for (const r of ordered) {
    const t = r.text.toLowerCase();
    if (needles.some(n => t.includes(n))) console.log(`y=${r.y} | ${r.text}`);
  }
})();
