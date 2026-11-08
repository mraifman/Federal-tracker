// A mixed account must expose only its reported discretionary dollars.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../research.js'),'utf8');
const begin=source.indexOf('function prepareDiscretionary()'),end=source.indexOf('function applyContinuity()',begin);
const fixture={records:[
 {id:'mixed',credit_scope:'NON-FINANCING ACCOUNTS',years:{2024:{metrics:{net_authority:1000,discretionary_net_authority:10},source_index:0,discretionary_source_rows:[{row:2,line:'4070'}]},2026:{metrics:{net_authority:2000,discretionary_net_authority:15},source_index:1}}},
 {id:'mandatory',credit_scope:'NON-FINANCING ACCOUNTS',years:{2024:{metrics:{net_authority:999}},2026:{metrics:{net_authority:999}}}},
 {id:'missing-current',credit_scope:'NON-FINANCING ACCOUNTS',years:{2024:{metrics:{discretionary_net_authority:5}},2026:{metrics:{net_authority:999},derived_metrics:{net_authority:{value:999}}}}},
 {id:'financing',credit_scope:'FINANCING ACCOUNTS',years:{2024:{metrics:{discretionary_net_authority:100}}}},
]};
const context=vm.createContext({authority:fixture,fundingRecords:[],isFin:r=>!r.credit_scope.startsWith('NON-')});
vm.runInContext(source.slice(begin,end)+';prepareDiscretionary();',context);
assert.deepEqual(Array.from(context.fundingRecords,r=>r.id),['mixed','missing-current']);
const mixed=context.fundingRecords[0],missing=context.fundingRecords[1];
assert.equal(mixed.years['2026'].metrics.net_authority,15);
assert.equal(mixed.years['2024'].source_rows[0].line,'4070');
assert.equal(missing.years['2026'].metrics.net_authority,null);
assert.equal(missing.years['2026'].derived_metrics,undefined);
assert.equal(fixture.records[0].years['2026'].metrics.net_authority,2000);
console.log('Discretionary-only selection, mixed accounts, missing values and original totals verified.');
