const fs = require('fs');
const path = require('path');

const root = 'd:/core_UI/coreui';
const invPath = path.join(root, 'src/app/views/estimations/work-details/inventory-data.ts');
const invText = fs.readFileSync(invPath,'utf8');
const arrText = invText.slice(invText.indexOf('['), invText.lastIndexOf(']')+1);
const items = Function('return (' + arrText + ');')();

const docs = {
  LOA_ABSS: JSON.parse(fs.readFileSync(path.join(root,'src/assets/converted/LOA_ABSS.json'),'utf8')),
  SOR_2024: JSON.parse(fs.readFileSync(path.join(root,'src/assets/converted/SOR_2024.json'),'utf8')),
  STTC: JSON.parse(fs.readFileSync(path.join(root,'src/assets/converted/STTC.json'),'utf8')),
  ZONAL_2024: JSON.parse(fs.readFileSync(path.join(root,'src/assets/converted/ZONAL_2024.json'),'utf8')),
};

function docType(ref=''){
  if(ref.includes('00850890090468')) return 'LOA_ABSS';
  if(ref.includes('01052610112449')) return 'STTC';
  if(ref.includes('01052610118677')) return 'ZONAL_2024';
  return 'SOR_2024';
}
function norm(s=''){
  return s.toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}
function sim(a,b){
  if(!a||!b) return 0;
  const A = new Set(a.split(' '));
  const B = new Set(b.split(' '));
  let inter = 0;
  for(const w of A) if(B.has(w)) inter++;
  const den = Math.max(A.size,B.size)||1;
  return inter/den;
}

function extractRows(doc){
  const rows=[];
  for(const table of doc){
    if(!Array.isArray(table)) continue;
    let currentSchedule = '';
    for(const row of table){
      if(!Array.isArray(row)) continue;
      const txt = row.map(x=>String(x||'')).join(' ');
      const sm = txt.match(/Schedule\s+([A-Z])/i);
      if(sm) currentSchedule = sm[1].toUpperCase();
      const s0 = String(row[0]||'').trim();
      const sl = /^\d+$/.test(s0) ? parseInt(s0,10) : null;
      const desc = String(row[2]||row[1]||'').trim();
      if(sl && sl>=1 && sl<=200 && desc && desc.length>20){
        rows.push({sl, desc: norm(desc), raw: desc, schedule: currentSchedule});
      }
    }
  }
  return rows;
}

const rowsByDoc = Object.fromEntries(Object.entries(docs).map(([k,v])=>[k,extractRows(v)]));
const mismatches=[];

items.forEach((it,idx)=>{
  const dt = docType(it.reference||'');
  const rows = rowsByDoc[dt]||[];
  const d = norm(it.description||'');
  if(!d) return;
  const sched = (it.schedule||'').toUpperCase();

  let best={score:0,row:null};
  for(const r of rows){
    if(sched && r.schedule && r.schedule!==sched) continue;
    const sc = sim(d,r.desc);
    if(sc>best.score) best={score:sc,row:r};
  }
  if((!best.row || best.score<0.92) && sched){
    for(const r of rows){
      const sc = sim(d,r.desc);
      if(sc>best.score) best={score:sc,row:r};
    }
  }

  if(best.row && best.score>=0.92){
    const cur = Number(it.slNo||0);
    if(cur!==best.row.sl){
      mismatches.push({idx,doc:dt,schedule:sched,curSl:cur,newSl:best.row.sl,score:+best.score.toFixed(3),desc:(it.description||'').slice(0,80)});
    }
  }
});

console.log('high_conf_slno_mismatches', mismatches.length);
console.log(JSON.stringify(mismatches.slice(0,300),null,2));
