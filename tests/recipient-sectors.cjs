// Regression for nonprofit descriptions that explicitly EXCLUDE higher education.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),vm=require('node:vm');
const root=path.join(__dirname,'..'),sourceRoot=p=>(p.startsWith('data/outbound')||p==='data/recipient-sector-audit.json')?(process.env.ATLAS_AWARD_OUTPUT_ROOT||root):root,read=p=>JSON.parse(p.endsWith('.gz')?zlib.gunzipSync(fs.readFileSync(path.join(sourceRoot(p),p))):fs.readFileSync(path.join(sourceRoot(p),p),'utf8'));
const index=read('data/outbound-awards.json');
assert.match(index.recipient_sector_version,/^fabs-explicit-codes-v[23]$/);
const rules=read('data/recipient-sector-rules.json');assert(rules.groups.Nonprofits.includes('M'));assert(!rules.groups.Academia.includes('M'));
const source=fs.readFileSync(path.join(root,'outflows.js'),'utf8');
const filterCode=source.slice(source.indexOf('function filtered('),source.indexOf('function pairs('));
const state={benefitPolicy:read('data/mandatory-benefit-programs.json'),basis:'funding',subject:'all',kind:'all',topic:'all',sector:'Academia',program:'',taxonomy:{}};
vm.createContext(state);vm.runInContext(filterCode,state);
for(const code of ['ALL','068']){
 const payload=read('data/outbound/'+code+'.json.gz');
 for(const basis of ['funding','awarding']){
  state.basis=basis;state.sector='Academia';
  assert(!state.filtered(payload.programs).some(r=>['66.957','66.960'].includes(r.program_code)),code+' GGRF must not be academic');
  state.sector='Nonprofits';
  const ncif=state.filtered(payload.programs).filter(r=>r.year===2024&&r.program_code==='66.957').reduce((s,r)=>s+r.amount,0);
  assert.equal(ncif,13970000000,code+' nonprofit NCIF obligations');
  const ccia=state.filtered(payload.programs).filter(r=>r.year===2024&&r.program_code==='66.960').reduce((s,r)=>s+r.amount,0);
  assert.equal(ccia,6000000000,code+' nonprofit CCIA obligations');
 }
}
const audit=read('data/recipient-sector-audit.json');
for(const row of audit.rows.filter(r=>r.source_kind==='assistance'&&['M','N','12','MX','NX'].includes(r.reported_business_types_code)))assert.equal(row.sector,'Nonprofits');
console.log('GGRF excluded from Academia and correctly retained under Nonprofits in both years/roles; M/N/12 exclusion wording cannot classify higher education.');
