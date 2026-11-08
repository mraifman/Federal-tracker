const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),benefitPolicy=JSON.parse(fs.readFileSync(path.join(root,'data/mandatory-benefit-programs.json'),'utf8'));
const source=fs.readFileSync(path.join(root,'outflows.js'),'utf8');
const code=source.slice(source.indexOf('function filtered('),source.indexOf('function pairs('));
const state={benefitPolicy,basis:'funding',subject:'all',kind:'all',topic:'all',sector:'',program:'',taxonomy:{}};vm.createContext(state);vm.runInContext(code,state);
const rows=['96.002','64.109','93.778','96.007','10.557','93.855','1510'].flatMap(program_code=>[2024,2026].map(year=>({program_code,year,basis:'funding',award_kind:program_code==='1510'?'Contracts':'Grants / cooperative agreements',amount:1})));
const filtered=state.filtered(rows);
assert.deepEqual(Array.from(new Set(filtered.map(r=>r.program_code))),['96.007','10.557','93.855','1510']);
for(const id of ['96.002','64.109','93.778']){state.program=id;assert.equal(state.filtered(rows).length,0);}
state.program='';state.basis='awarding';assert.equal(state.filtered(rows.map(r=>({...r,basis:'awarding'}))).length,8);
// The dedicated award page applies the same identifier policy.
const html=fs.readFileSync(path.join(root,'spending-detail.html'),'utf8');assert(html.includes("!Object.hasOwn(benefitPolicy.programs,String(r.program_code))"));
console.log('Benefits excluded in both years and roles; research grants, WIC and contracts retained.');
