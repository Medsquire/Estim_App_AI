const fs=require('fs');
const p='d:/core_UI/coreui/src/app/views/estimations/work-details/inventory-data.ts';
const t=fs.readFileSync(p,'utf8');
const arr=Function('return ('+t.slice(t.indexOf('['),t.lastIndexOf(']')+1)+')')();
const idxs=[52,53,92,152,170,174,175,176,319,320,507,55,236];
for(const i of idxs){const it=arr[i]; console.log(i, 'sl',it.slNo,'pg',it.page_no,'sch',it.schedule,'desc',String(it.description).slice(0,90));}
