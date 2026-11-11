/* Follow one agency across the three measures the site already publishes:
   OPM headcount, OMB SF 133 budget authority and USAspending award obligations.
   Each measure keeps its own scale and source; nothing is normalized or added across them. */
(()=>{'use strict';
const host=document.getElementById('agency-transitions');if(!host)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>n==null?'—':Math.round(n).toLocaleString('en-US');
const money=n=>n==null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:n>=1e12||n<=-1e12?2:1}).format(n);
const pct=(a,b)=>a>0&&b!=null?(b/a-1)*100:null;
const fmtPct=p=>p==null?'n/a':(p>0?'+':'')+p.toFixed(1)+'%';
const sign=(n,f)=>n==null?'—':(n>0?'+':n<0?'−':'')+f(Math.abs(n));
const title=v=>window.AtlasChartTools?.displayName?window.AtlasChartTools.displayName(v):String(v||'');
async function get(path){const r=await fetch(path+'?v=sectors-20261111');if(!r.ok)throw Error(path);if(!path.endsWith('.gz'))return r.json();const raw=await r.arrayBuffer(),b=new Uint8Array(raw);if(b[0]===31&&b[1]===139)return JSON.parse(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).text());return JSON.parse(new TextDecoder().decode(raw));}
let agencies=[],current='',sortKey='funding',sortDir=-1,showAll=false;
const MEASURES=[
 {key:'people',label:'People',sub:'Civilian employees · OPM',a:'Dec 2024',b:'Sep 2026',fmt:num,explore:'Explore in People →'},
 {key:'funding',label:'Funding',sub:'Funds committed (obligations) · OMB SF 133 · non-entitlement, non-interest funding scope',a:'FY2024',b:'FY2026',fmt:money,explore:'Explore in Funding Priorities →'},
 {key:'awards',label:'Awards',sub:'Award obligations · USAspending · benefits excluded',a:'FY2024',b:'FY2026',fmt:money,explore:'Explore in Money Flows →'}
];
Promise.all([get('data/workforce-changes.json'),get('data/authority-comparison.json'),get('data/entitlement-accounts.json'),get('data/agencies.json'),get('data/spending-workforce-crosswalk.json'),get('data/outbound/agency-changes.json.gz')]).then(([work,authority,ent,directory,cross,awardRows])=>{
 const entitlement=new Set(ent.groups.flatMap(g=>g.accounts.map(x=>x.treasury_account))),excludedTopics=new Set(ent.excluded_topics||[]);
 const byId=new Map(authority.records.map(r=>[r.id,r])),funding={};
 for(const [code,ids] of Object.entries(cross.authority_records||{})){const f={name:'',a:null,b:null,omb:{}};for(const id of ids){const r=byId.get(id);if(!r||!String(r.credit_scope).startsWith('NON-')||entitlement.has(r.treasury_account)||excludedTopics.has(r.topic))continue;f.name||=r.agency;f.omb[r.agency_code]=(f.omb[r.agency_code]||0)+1;for(const [y,k] of [['2024','a'],['2026','b']]){const v=r.years[y]?.metrics?.obligations;if(v!=null)f[k]=(f[k]??0)+v}}if(f.a!=null||f.b!=null){f.agency_code=Object.entries(f.omb).sort((x,y)=>y[1]-x[1])[0]?.[0];funding[code]=f}}
 const awards={};for(const r of awardRows){if(r.basis!=='funding')continue;const w=awards[r.agency_code]??={name:r.agency_name,a:0,b:0};w[r.year===2024?'a':'b']+=r.amount||0}
 const people={};for(const d of work.records.departments)people[d.id]={name:d.name,a:d.values['202412']??null,b:d.values['202609']??null};
 const names=Object.fromEntries(directory.agencies.map(a=>[a.code,a.name]));
 const codes=new Set([...Object.keys(funding),...Object.keys(awards)]);
 for(const code of codes){
  const opm=cross.links[code],p=opm?people[opm]:null;
  const row={code,opm,name:names[code]||funding[code]?.name||awards[code]?.name||code,people:p?{a:p.a,b:p.b,incomplete:opm==='DOD'}:null,funding:funding[code]&&(funding[code].a!=null||funding[code].b!=null)?funding[code]:null,awards:awards[code]&&(awards[code].a||awards[code].b)?awards[code]:null};
  row.measures=['people','funding','awards'].filter(k=>row[k]);
  if(row.measures.length>=2)agencies.push(row);
 }
 agencies.sort((x,y)=>x.name.localeCompare(y.name));
 const preferred=agencies.find(a=>/homeland security/i.test(a.name))||agencies[0];current=preferred?.code||'';
 render();
}).catch(e=>{host.innerHTML='<p class="warning">The agency comparison could not load its source datasets ('+esc(e.message)+'). Reload to retry.</p>'});
function delta(row,key){const m=row[key];return m&&m.a!=null&&m.b!=null?m.b-m.a:null}
function deltaPct(row,key){const m=row[key];return m?pct(m.a,m.b):null}
function card(row,m){
 const v=row[m.key];
 if(!v)return '<article class="transition-card is-empty"><h3>'+m.label+'</h3><p class="t-sub">'+esc(m.sub)+'</p><p class="t-missing">No '+m.label.toLowerCase()+' records are linked to this agency in the retained sources.</p></article>';
 const d=delta(row,m.key),p=deltaPct(row,m.key),max=Math.max(1,Math.abs(v.a??0),Math.abs(v.b??0))*1.08,pos=x=>Math.max(0,Math.min(100,(x??0)/max*100)),tone=d==null?'neutral':d<0?'loss':d>0?'gain':'neutral';
 return '<article class="transition-card" data-tone="'+tone+'"><h3>'+m.label+'</h3><p class="t-sub">'+esc(m.sub)+'</p><div class="t-values"><span>'+m.a+'<b>'+m.fmt(v.a)+'</b></span><span>'+m.b+'<b>'+m.fmt(v.b)+'</b></span></div><div class="t-track" aria-hidden="true"><i class="t-line" style="left:'+Math.min(pos(v.a),pos(v.b))+'%;width:'+Math.abs(pos(v.a)-pos(v.b))+'%"></i><i class="t-before" style="left:'+pos(v.a)+'%"></i><i class="t-after" style="left:'+pos(v.b)+'%"></i></div><p class="t-change"><b>'+sign(d,m.fmt)+'</b><span>'+fmtPct(p)+'</span></p>'+(v.incomplete?'<p class="t-note">September 2026 defense submissions are incomplete; this count understates Defense.</p>':'')+'<button type="button" class="outline" data-explore="'+m.key+'">'+m.explore+'</button></article>';
}
function render(){
 const row=agencies.find(a=>a.code===current);if(!row)return;
 const sorted=[...agencies].sort((x,y)=>{const mag=v=>v==null?null:Math.abs(v),a=sortKey==='name'?x.name:mag(delta(x,sortKey)),b=sortKey==='name'?y.name:mag(delta(y,sortKey));if(a==null&&b==null)return 0;if(a==null)return 1;if(b==null)return -1;return (a>b?1:a<b?-1:0)*(sortKey==='name'?1:sortDir)});
 const shown=showAll?sorted:sorted.slice(0,12);
 const th=(key,label)=>'<th><button type="button" data-sort="'+key+'" aria-sort="'+(sortKey===key?(sortDir<0?'descending':'ascending'):'none')+'">'+label+(sortKey===key?(sortDir<0?' ↓':' ↑'):'')+'</button></th>';
 host.innerHTML='<div class="section-heading"><div><p class="eyebrow">Across the three measures</p><h2>Follow one agency across people, funding and awards</h2><p class="section-lede">Pick an agency to see its headcount, budget authority and award obligations side by side, FY2024 → FY2026. Each measure keeps its own scale and source; they are not added together.</p></div></div>'+
 '<div class="transitions-controls"><label>Agency<select id="transitions-agency">'+agencies.map(a=>'<option value="'+esc(a.code)+'" '+(a.code===current?'selected':'')+'>'+esc(title(a.name))+'</option>').join('')+'</select></label><p class="t-scope">'+esc(title(row.name))+' · '+row.measures.length+' of 3 measures linked</p></div>'+
 '<div class="transition-cards">'+MEASURES.map(m=>card(row,m)).join('')+'</div>'+
 '<details class="transition-table" '+(showAll?'open':'')+'><summary>Compare every agency · sort by any measure</summary><div class="table-scroll"><table><thead><tr>'+th('name','Agency')+th('people','Headcount change')+th('funding','Committed funds change')+th('awards','Award change')+'</tr></thead><tbody>'+shown.map(a=>'<tr data-code="'+esc(a.code)+'" '+(a.code===current?'class="is-current"':'')+'><td><button type="button" class="agency-link" data-pick="'+esc(a.code)+'">'+esc(title(a.name))+'</button></td><td data-tone="'+tone(deltaPct(a,'people'))+'">'+(a.people?sign(delta(a,'people'),num)+' <small>'+fmtPct(deltaPct(a,'people'))+'</small>':'—')+'</td><td data-tone="'+tone(delta(a,'funding'))+'">'+(a.funding?sign(delta(a,'funding'),money)+' <small>'+fmtPct(deltaPct(a,'funding'))+'</small>':'—')+'</td><td data-tone="'+tone(delta(a,'awards'))+'">'+(a.awards?sign(delta(a,'awards'),money)+' <small>'+fmtPct(deltaPct(a,'awards'))+'</small>':'—')+'</td></tr>').join('')+'</tbody></table></div><div class="table-footer"><span>'+shown.length+' of '+agencies.length+' agencies</span>'+(showAll?'':'<button type="button" class="outline" id="transitions-more">Show all '+agencies.length+'</button>')+'</div></details>'+
 '<p class="data-sources"><span>Data &amp; sources</span><a href="https://data.opm.gov/get-data/data-downloads" target="_blank" rel="noopener">OPM FedScope ↗</a><a href="https://www.whitehouse.gov/omb/information-resources/guidance/budget-execution-reporting/" target="_blank" rel="noopener">OMB SF 133 ↗</a><a href="https://www.usaspending.gov/download_center/award_data_archive" target="_blank" rel="noopener">USAspending archives ↗</a><a href="data/spending-workforce-crosswalk.json">Agency crosswalk (JSON) ↓</a></p>';
 host.querySelector('#transitions-agency').onchange=e=>{current=e.target.value;render()};
 host.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{current=b.dataset.pick;render();host.querySelector('.transition-cards').scrollIntoView({behavior:'smooth',block:'center'})});
 host.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{if(sortKey===b.dataset.sort)sortDir=-sortDir;else{sortKey=b.dataset.sort;sortDir=-1}const open=host.querySelector('.transition-table').open;render();host.querySelector('.transition-table').open=open||true});
 const more=host.querySelector('#transitions-more');if(more)more.onclick=()=>{showAll=true;render();host.querySelector('.transition-table').open=true};
 host.querySelectorAll('[data-explore]').forEach(b=>b.onclick=()=>explore(row,b.dataset.explore));
}
function tone(d){return d==null?'neutral':d<0?'loss':d>0?'gain':'neutral'}
function explore(row,key){
 const tab=key==='people'?'workforce':key==='funding'?'funding':'uses';
 if(key==='people'&&row.opm){window.dispatchEvent(new CustomEvent('atlas-focus-workforce',{detail:{department:row.opm}}));document.querySelector('[data-project-tab="workforce"]')?.click();}
 else if(key==='funding')window.dispatchEvent(new CustomEvent('atlas-focus-funding',{detail:{agency:row.funding?.agency_code||'all',topic:'all'}}));
 else window.dispatchEvent(new CustomEvent('horizon-focus-award-agency',{detail:{code:row.code}}));
 document.getElementById(tab+'-panel')?.scrollIntoView({behavior:'smooth',block:'start'});
}
// The block lives inside whichever investigation tab is open; it is never part of About the Evidence.
function place(){const view=document.body.dataset.view||'workforce';const panel=document.getElementById({workforce:'workforce',funding:'funding',uses:'uses'}[view]+'-panel');if(!panel){host.hidden=true;return}host.hidden=false;if(host.parentElement!==panel)panel.append(host)}
place();new MutationObserver(place).observe(document.body,{attributes:true,attributeFilter:['data-view']});
// Keep the picker in step with selections made elsewhere on the page.
window.addEventListener('horizon-focus-award-agency',e=>{if(agencies.some(a=>a.code===e.detail?.code)){current=e.detail.code;render()}});
window.addEventListener('atlas-focus-workforce',e=>{const hit=agencies.find(a=>a.opm===e.detail?.department);if(hit){current=hit.code;render()}});
})();
