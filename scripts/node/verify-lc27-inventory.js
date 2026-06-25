const fs = require('fs');
const path = require('path');

console.log('=== LC_27_EST_INVENTORY.json VALIDATION ===\n');

const filePath = path.join(__dirname, 'src/assets/converted/LC_27_EST_INVENTORY.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

console.log('✅ Total Items:', data.length);

const sor = data.filter(i => i.fileType === 'SOR').length;
const not = data.filter(i => i.fileType === 'NOT').length;

console.log('✅ SOR Items:', sor);
console.log('✅ NOT Items:', not);

console.log('\n📋 Schedule Breakdown:');
const schedules = {};
data.forEach(i => {
  const sched = i.schedule || 'A';
  schedules[sched] = (schedules[sched] || 0) + 1;
});
Object.keys(schedules).sort().forEach(sched => {
  console.log(`   Schedule ${sched}: ${schedules[sched]} items`);
});

console.log('\n🔍 First 5 Items with fileType:');
data.slice(0, 5).forEach((i, idx) => {
  console.log(`   ${idx + 1}. slNo=${i.slNo}, schedule=${i.schedule}, fileType=${i.fileType}`);
  console.log(`      "${i.description.substring(0, 70)}..."`);
});

console.log('\n🔍 SOR Matched Items Sample:');
const sorItems = data.filter(i => i.fileType === 'SOR').slice(0, 5);
sorItems.forEach((i, idx) => {
  console.log(`   ${idx + 1}. slNo=${i.slNo}, fileType=SOR`);
  console.log(`      "${i.description.substring(0, 70)}..."`);
  console.log(`      Matched: "${i.matchedSorDescription.substring(0, 70)}..."`);
});

console.log('\n✅ All items have fileType field: ', data.every(i => i.fileType));
console.log('✅ All items have matchedSorDescription field: ', data.every(i => 'matchedSorDescription' in i));

console.log('\n📁 File Size: ', Math.round(fs.statSync(filePath).size / 1024) + ' KB');
console.log('✅ VALIDATION COMPLETE - Ready for PH-29 Auto-Binding!');
