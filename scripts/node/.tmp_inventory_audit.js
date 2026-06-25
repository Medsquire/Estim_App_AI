const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadPdfjs() {
  const candidates = [
    'pdfjs-dist/legacy/build/pdf.js',
    'pdfjs-dist/legacy/build/pdf.mjs',
    'pdfjs-dist/build/pdf.js',
  ];
  for (const c of candidates) {
    try {
      return { mod: require(c), esm: false };
    } catch (e) {}
  }
  return null;
}

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP = new Set(['the','and','for','with','from','that','this','shall','per','all','are','as','or','of','to','in','on','by','be','is','at','no','nos','etc','any','an','a','it','its','latest','supply','including']);
function tokens(s) {
  return Array.from(new Set(normalize(s).split(' ').filter(w => w.length > 2 && !STOP.has(w))));
}

function tokenScore(descTokens, pageTokenSet) {
  if (!descTokens.length) return 0;
  let hit = 0;
  for (const t of descTokens) if (pageTokenSet.has(t)) hit++;
  return hit / descTokens.length;
}

function maxRunScore(descTokens, pageNorm) {
  if (!descTokens.length) return 0;
  let maxRun = 0;
  for (let i = 0; i < descTokens.length; i++) {
    let run = 0;
    let phrase = '';
    for (let j = i; j < Math.min(descTokens.length, i + 10); j++) {
      phrase = (phrase ? phrase + ' ' : '') + descTokens[j];
      if (pageNorm.includes(phrase)) {
        run++;
        if (run > maxRun) maxRun = run;
      } else {
        break;
      }
    }
  }
  return Math.min(1, maxRun / 6);
}

function lineMatchIndex(lines, descToks) {
  let best = { idx: -1, score: 0 };
  const dset = new Set(descToks);
  for (let i = 0; i < lines.length; i++) {
    const lt = tokens(lines[i]);
    if (!lt.length) continue;
    let hit = 0;
    for (const t of lt) if (dset.has(t)) hit++;
    const score = hit / Math.max(6, Math.min(descToks.length, 24));
    if (score > best.score) best = { idx: i, score };
  }
  return best;
}

function detectSlNo(lines, centerIdx) {
  if (centerIdx < 0) return { slNo: null, confidence: 0 };
  const window = 7;
  const cands = [];
  for (let d = 0; d <= window; d++) {
    for (const idx of [centerIdx - d, centerIdx + d]) {
      if (idx < 0 || idx >= lines.length) continue;
      const line = (lines[idx] || '').trim();
      const m = line.match(/^(\d{1,4})\s*[\).:-]?\s+/);
      if (m) {
        const n = Number(m[1]);
        if (Number.isFinite(n) && n > 0 && n < 5000) {
          const dist = Math.abs(idx - centerIdx);
          const confidence = Math.max(0.5, 1 - dist / (window + 1));
          cands.push({ slNo: n, confidence, idx, line });
        }
      }
      const m2 = line.match(/\b(?:sl\s*no\.?|item\s*no\.?)\s*[:\-]?\s*(\d{1,4})\b/i);
      if (m2) {
        const n2 = Number(m2[1]);
        if (Number.isFinite(n2) && n2 > 0 && n2 < 5000) {
          const dist = Math.abs(idx - centerIdx);
          const confidence = Math.max(0.6, 1 - dist / (window + 1));
          cands.push({ slNo: n2, confidence, idx, line });
        }
      }
    }
  }
  cands.sort((a, b) => b.confidence - a.confidence);
  return cands[0] || { slNo: null, confidence: 0 };
}

function mapPdf(reference) {
  const r = reference || '';
  if (r.includes('00850890090468')) return 'LOA ABSS.pdf';
  if (r.includes('01052610112449')) return 'STTC.pdf';
  if (r.includes('01052610118677')) return 'zonal2024_loa.pdf';
  return 'SOR 2024.pdf';
}

function loadInventory(invPath) {
  const raw = fs.readFileSync(invPath, 'utf8');
  const rewritten = raw.replace(/export\s+const\s+EXTRACTED_INVENTORY\s*=\s*/, 'const EXTRACTED_INVENTORY = ');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`${rewritten}\n;globalThis.__INV__ = EXTRACTED_INVENTORY;`, sandbox, { timeout: 10000 });
  return sandbox.__INV__;
}

async function extractPdfPages(pdfjsLib, pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const task = pdfjsLib.getDocument({ data, isEvalSupported: false, useWorkerFetch: false, disableFontFace: true });
  const pdf = await task.promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const p = await pdf.getPage(i);
    const tc = await p.getTextContent();
    const strs = tc.items.map(x => (x && x.str) ? x.str : '');
    const text = strs.join(' ');
    const lines = text.split(/\s{2,}|\n+/).map(s => s.trim()).filter(Boolean);
    pages.push({ pageNo: i, text, lines, norm: normalize(text), tset: new Set(tokens(text)) });
  }
  return pages;
}

(async () => {
  const root = process.cwd();
  const invPath = path.join(root, 'src/app/views/estimations/work-details/inventory-data.ts');
  const inventory = loadInventory(invPath);

  const loader = loadPdfjs();
  if (!loader) throw new Error('pdfjs-dist could not be loaded via require.');
  const pdfjsLib = loader.mod;

  const pdfDir = path.join(root, 'uploads/pdf');
  const pdfNames = ['LOA ABSS.pdf', 'SOR 2024.pdf', 'STTC.pdf', 'zonal2024_loa.pdf'];
  const pdfCache = {};
  for (const name of pdfNames) {
    const p = path.join(pdfDir, name);
    if (!fs.existsSync(p)) {
      pdfCache[name] = null;
      continue;
    }
    pdfCache[name] = await extractPdfPages(pdfjsLib, p);
  }

  let checked = 0;
  const mismatches = [];
  let pageMismatchCount = 0;
  let slMismatchCount = 0;

  for (let i = 0; i < inventory.length; i++) {
    const item = inventory[i];
    if (!item || !item.description) continue;
    const pdfName = mapPdf(item.reference || '');
    const pages = pdfCache[pdfName];
    if (!pages || !pages.length) continue;

    checked++;
    const dNorm = normalize(item.description);
    const dTok = tokens(item.description);
    let best = { pageNo: null, score: 0, lineIndex: -1, lineScore: 0 };

    for (const pg of pages) {
      let score = 0;
      const shortSnippet = dNorm.split(' ').slice(0, 12).join(' ');
      if (shortSnippet && pg.norm.includes(shortSnippet)) {
        score = 0.96;
      } else {
        const ts = tokenScore(dTok, pg.tset);
        const rs = maxRunScore(dTok, pg.norm);
        score = 0.72 * ts + 0.28 * rs;
      }
      if (score > best.score) {
        const lm = lineMatchIndex(pg.lines, dTok);
        best = { pageNo: pg.pageNo, score, lineIndex: lm.idx, lineScore: lm.score };
      }
    }

    const bestPage = pages[best.pageNo - 1];
    const sl = bestPage ? detectSlNo(bestPage.lines, best.lineIndex) : { slNo: null, confidence: 0 };
    const pageConf = Number(best.score.toFixed(3));
    const slConf = Number((Math.min(1, 0.65 * pageConf + 0.35 * sl.confidence)).toFixed(3));

    const pageMismatch = Number.isFinite(item.page_no) && best.pageNo && item.page_no !== best.pageNo && pageConf >= 0.8;
    const slMismatch = Number.isFinite(item.slNo) && Number.isFinite(sl.slNo) && item.slNo !== sl.slNo && slConf >= 0.8;

    if (pageMismatch) pageMismatchCount++;
    if (slMismatch) slMismatchCount++;

    if (pageMismatch || slMismatch) {
      const conf = pageMismatch ? pageConf : slConf;
      mismatches.push({
        index: i,
        current: { page_no: item.page_no ?? null, slNo: item.slNo ?? null },
        detected: { page_no: best.pageNo ?? null, slNo: sl.slNo ?? null },
        pdf: pdfName,
        confidence: conf,
        uncertain: conf < 0.8,
        kind: pageMismatch && slMismatch ? 'page_no+slNo' : (pageMismatch ? 'page_no' : 'slNo'),
        description: String(item.description).slice(0, 180)
      });
    }
  }

  mismatches.sort((a, b) => b.confidence - a.confidence);
  const top = mismatches.slice(0, 200);

  const report = [];
  report.push(`total_items=${inventory.length}`);
  report.push(`checked_items=${checked}`);
  report.push(`page_no_mismatches=${pageMismatchCount}`);
  report.push(`slNo_mismatches=${slMismatchCount}`);
  report.push(`top_mismatches_returned=${top.length}`);
  report.push('--- TOP MISMATCHES (max 200) ---');
  top.forEach((m, idx) => {
    report.push(`${idx + 1}. idx=${m.index} kind=${m.kind} current(page=${m.current.page_no},sl=${m.current.slNo}) detected(page=${m.detected.page_no},sl=${m.detected.slNo}) conf=${m.confidence}${m.uncertain ? ' uncertain' : ''} pdf=${m.pdf}`);
  });

  const payload = {
    summary: {
      total_items: inventory.length,
      checked_items: checked,
      page_no_mismatches: pageMismatchCount,
      slNo_mismatches: slMismatchCount,
      returned: top.length
    },
    mismatches: top.map(m => ({
      index: m.index,
      confidence: m.confidence,
      uncertain: m.uncertain,
      suggested: {
        page_no: m.detected.page_no,
        slNo: m.detected.slNo
      },
      current: m.current,
      kind: m.kind,
      pdf: m.pdf
    }))
  };

  console.log(report.join('\n'));
  console.log('---JSON_PAYLOAD_START---');
  console.log(JSON.stringify(payload, null, 2));
  console.log('---JSON_PAYLOAD_END---');
})();
