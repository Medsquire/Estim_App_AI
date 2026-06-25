const fs=require('fs');
const p='d:/core_UI/coreui/src/app/views/estimations/work-details/inventory-data.ts';
const txt=fs.readFileSync(p,'utf8');
const lines=txt.split(/\r?\n/);
const targets={
  page:[52,53,507,92,319,320,152,170,174,175,176],
  sl:[55,236]
};
let idx=-1;
for(let i=0;i<lines.length;i++){
  if(lines[i].includes('"description":')) idx++;
  if(targets.page.includes(idx) && lines[i].includes('"page_no"')){
    console.log('PAGE',idx,'line',i+1,lines[i].trim());
  }
  if(targets.sl.includes(idx) && lines[i].includes('"slNo"')){
    console.log('SL',idx,'line',i+1,lines[i].trim());
  }
}
