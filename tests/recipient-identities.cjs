const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{},query:'',awardSort:'change'};
vm.runInNewContext(fs.readFileSync('atlas-chart-tools.js','utf8'),context);
const identity=context.window.AtlasChartTools;
for(const [id,name,identified] of [
 ['XFJMYSYFJEK4','Lockheed Martin Corporation',true],
 ['','Redacted Due To PII',false],['Unreported','Name unavailable',false],
 ['INDIVIDUALS','Individuals — names not published',false],
 ['ABC123456789','Miscellaneous Foreign Awardees',false],
 ['ABC123456789','Individual Software Inc',true],['ABC123456789','PII LLC',true],['ABC123456789','Redacted Inc',true]
])assert.equal(identity.recipientIdentity({id,name}).identified,identified,name);
const pairs=fs.readFileSync('outflows.js','utf8').split('\n').find(line=>line.startsWith('function pairs('));
assert(pairs,'recipient pairing function must be available');vm.runInNewContext(pairs,context);
const rows=[
 {recipient_id:'',recipient_name:'Redacted Due To PII',year:2024,amount:-611090000,transaction_count:1,known_amount_count:1},
 {recipient_id:'',recipient_name:'Redacted Due To PII',year:2026,amount:9890000000,transaction_count:1,known_amount_count:1},
 {recipient_id:'',recipient_name:'Another reported group',year:2026,amount:100,transaction_count:1,known_amount_count:1},
 {recipient_id:'XFJMYSYFJEK4',recipient_name:'Lockheed Martin Corporation',year:2026,amount:200,transaction_count:1,known_amount_count:1}
];
const results=context.pairs(rows,'recipient_id','recipient_name');
assert.equal(results.length,3,'different missing-ID names must not merge into one recipient');
assert.equal(results.filter(row=>identity.recipientIdentity(row).identified).length,1);
for(const [year,key]of [[2024,'a'],[2026,'b']])assert.equal(results.reduce((sum,row)=>sum+row[key],0),rows.filter(row=>row.year===year).reduce((sum,row)=>sum+row.amount,0));
const redacted=results.find(row=>row.name==='Redacted Due To PII');
assert.equal(redacted.a,-611090000);assert.equal(redacted.b,9890000000);
assert.equal(rows.filter(row=>identity.recipientGroupKey(row)===redacted.id).length,2,'group drilldown must select only its own source rows');
assert.equal(redacted.sourceId,'','the original missing identifier must be retained');
console.log('Recipient identities: placeholder separation, classification and fiscal-year totals verified.');
