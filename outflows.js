/* Full-archive, transaction-level external award analysis. */
(()=>{'use strict';const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),money=n=>n==null?'Unavailable':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(n),signed=n=>(n>0?'+':'')+money(n);let taxonomy={},subject='all',index,unit,recipientRows=[],code='NIH',basis='funding',kind='all',topic='all',group='sector',sector='',program='',query='',limit=25,version=0;const cache=new Map();
async function get(path){if(!cache.has(path))cache.set(path,fetch(path).then(r=>{if(!r.ok)throw Error('Source aggregate unavailable');if(!path.endsWith('.gz'))return r.json();return r.arrayBuffer().then(async raw=>{const bytes=new Uint8Array(raw);if(bytes[0]===31&&bytes[1]===139){const stream=new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'));return JSON.parse(await new Response(stream).text())}return JSON.parse(new TextDecoder().decode(raw))})}));return cache.get(path)}
function host(){let h=document.getElementById('outbound-panel');if(!h){h=document.createElement('section');h.id='outbound-panel';document.getElementById('uses-app')?.append(h)}return h}
async function load(next){code=next;const v=++version,h=host();h.innerHTML='<p class="scope-note">Loading public award allocations…</p>';try{[index,taxonomy]=await Promise.all([get('data/outbound-awards.json'),get('data/grant-subjects.json')]);const u=index.units.find(u=>u.code===code);if(!u){h.innerHTML='<p class="scope-note">No transactions were reported under this agency identifier in the retained archives. This does not establish zero funding or closure.</p>';return}unit=await get(u.file);recipientRows=[];if(v===version)render()}catch(e){if(v===version)h.innerHTML='<p class="warning">The external-award aggregate could not be loaded. Reload to retry; missing records are not recorded as zero.</p>'}}
function filtered(rows){return rows.filter(r=>r.basis===basis&&(subject==='all'||r.award_kind==='Grants / cooperative agreements'&&taxonomy[r.program_code]?.subject===subject)&&(kind==='all'||r.award_kind===kind)&&(topic==='all'||topic==='environment'&&r.environment_lens||r.topic_code===topic)&&(!sector||r.sector===sector)&&(!program||r.program_code===program))}
function pairs(rows,key,name){const map=new Map();for(const r of rows){const id=r[key]||'Unreported',label=r[name]||id;if(!map.has(id))map.set(id,{id,name:label,a:0,b:0,transactions:0,known:0});const x=map.get(id);x[r.year===2024?'a':'b']+=r.amount||0;x.transactions+=r.transaction_count;x.known+=r.known_amount_count}return [...map.values()].filter(r=>(r.name+' '+r.id).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>Math.abs(b.b-b.a)-Math.abs(a.b-a.a))}
async function recipients(){if(!recipientRows.length)recipientRows=await get(unit.recipients_file);group='recipient';render()}
function select(row){query='';limit=25;if(group==='subject'){subject=row.id;group='program';render()}else if(group==='sector'){sector=row.id;group='program';render()}else if(group==='program'){program=row.id;recipients()}else{const el=document.getElementById('outbound-selection');el.textContent=row.name+': '+money(row.a)+' → '+money(row.b)+'; '+signed(row.b-row.a)+'.'}}
let flowMode='2026';
function grantFlow(){
 const source=filtered(unit.programs).filter(r=>r.award_kind==='Grants / cooperative agreements');
 if(!source.length)return;
 const panel=document.createElement('section');
 panel.className='grant-flow';panel.id='grant-flow';
 document.getElementById('outbound-bubbles').before(panel);
 const totals=new Map(), edges=new Map();
 for(const r of source){
  const subject=taxonomy[r.program_code]?.subject||'Purpose unresolved';
  totals.set(subject,(totals.get(subject)||0)+Math.abs(r.amount||0));
 }
 const top=new Set([...totals].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([name])=>name));
 for(const r of source){
  const name=taxonomy[r.program_code]?.subject||'Purpose unresolved';
  const subject=top.has(name)?name:'Other subjects';
  const key=JSON.stringify([subject,r.sector]);
  if(!edges.has(key))edges.set(key,{subject,sector:r.sector,2024:0,2026:0});
  edges.get(key)[r.year]+=r.amount||0;
 }
 function draw(){
  const links=[...edges.values()].map(d=>({...d,delta:d[2026]-d[2024]}));
  const amount=d=>flowMode==='gains'?Math.max(0,d.delta):flowMode==='losses'?Math.max(0,-d.delta):Math.max(0,d[flowMode]);
  const active=links.filter(d=>amount(d)>0);
  const sum=active.reduce((s,d)=>s+amount(d),0);
  const ref=Math.max(1,...['2024','2026'].map(y=>links.reduce((s,d)=>s+Math.max(0,d[y]),0)));
  const scale=310/(flowMode==='gains'||flowMode==='losses'?Math.max(1,...[1,-1].map(sign=>links.reduce((s,d)=>s+Math.max(0,sign*d.delta),0))):ref);
  panel.innerHTML='<p class="eyebrow">Grant obligations · '+esc(unit.name)+'</p><h2>Where grant funding flows</h2><div class="flow-switch"></div><p class="flow-detail" aria-live="polite"></p><div class="flow-scroll"><svg viewBox="0 0 960 635" role="group" aria-label="Grant subjects flowing to recipient sectors"></svg></div><small>Ribbon width represents dollars. The change views compare net obligations for each subject and recipient-sector pair. Other subjects combines the smaller subjects. Annual ribbons show positive net flows.</small>';
  const detail=panel.querySelector('.flow-detail');
  detail.textContent=money(sum)+' in '+({gains:'increases',losses:'decreases'}[flowMode]||'positive net grant flows in FY'+flowMode)+'. Select a ribbon for both years.';
  for(const [id,label] of [['2024','FY2024'],['2026','FY2026'],['gains','Funding increases'],['losses','Funding decreases']]){
   const button=document.createElement('button');button.textContent=label;button.setAttribute('aria-pressed',String(id===flowMode));button.onclick=()=>{flowMode=id;draw();panel.querySelector('[aria-pressed=true]').focus({preventScroll:true})};panel.querySelector('.flow-switch').append(button);
  }
  const svg=d3.select(panel.querySelector('svg'));
  function column(key,x,anchor){
   const groups=d3.rollups(active,rows=>d3.sum(rows,amount),d=>d[key]).sort((a,b)=>b[1]-a[1]);
   const positions=new Map();let y=40;
   svg.append('text').attr('x',x).attr('y',18).attr('text-anchor',anchor).attr('font-weight',700).text(key==='subject'?'Grant purpose':'Recipient sector');
   for(const [name,value] of groups){
    positions.set(name,y);const h=value*scale;
    svg.append('rect').attr('x',key==='subject'?x+6:x-12).attr('y',y).attr('width',6).attr('height',Math.max(1,h)).attr('fill','#253e45');
    const label=svg.append('text').attr('x',x).attr('y',y+h/2).attr('text-anchor',anchor);
    label.append('tspan').text(name);label.append('tspan').attr('x',x).attr('dy',17).attr('font-weight',650).text(money(value));y+=h+37;
   }return positions;
  }
  const left=column('subject',265,'end'),right=column('sector',721,'start');
  for(const d of active.sort((a,b)=>left.get(a.subject)-left.get(b.subject))){
   const h=amount(d)*scale,y=left.get(d.subject),z=right.get(d.sector);
   const info=d.subject+' → '+d.sector+' · FY2024 '+money(d[2024])+' → FY2026 '+money(d[2026])+' · change '+signed(d.delta);
   const path=svg.append('path').attr('d',`M277,${y} C475,${y} 515,${z} 709,${z} v${h} C515,${z+h} 475,${y+h} 277,${y+h}Z`).attr('fill',d.delta<0?'#b56850':'#387e80').attr('opacity',.7).attr('tabindex',0).attr('aria-label',info).on('mouseenter focus click',()=>{detail.textContent=info;svg.selectAll('path').attr('opacity',.17);path.attr('opacity',1)}).on('mouseleave blur',()=>svg.selectAll('path').attr('opacity',.7));path.append('title').text(info);
   left.set(d.subject,y+h);right.set(d.sector,z+h);
  }
 }
 draw();
}

function renderAwardGraphic(rows, onSelect) {
 const chart=document.getElementById('outbound-bubbles');
 const shown=rows.slice(0,20);
 const low=Math.min(0,...shown.flatMap(r=>[r.a,r.b]));
 const high=Math.max(0,...shown.flatMap(r=>[r.a,r.b]));
 const position=value=>4+92*(value-low)/(high-low||1);
 const titleCase=name=>name===name.toUpperCase()?name.toLowerCase().replace(/^./,c=>c.toUpperCase()).replace(/\b(nih|cdc|hiv|aids|usda|nsf|epa|fema|stem)\b/gi,c=>c.toUpperCase()):name;
 chart.className='award-graphic endpoint-graphic';
 chart.innerHTML='<h3>Largest changes in award obligations</h3><p class="endpoint-key">○ FY2024　● FY2026　·　Each row uses the same dollar scale.</p><div class="award-grid"></div>';
 const grid=chart.querySelector('.award-grid');
 for(const row of shown){
  const change=row.b-row.a;
  const button=document.createElement('button');
  button.className='award-mark';
  const start=position(row.a),end=position(row.b);
  button.style.setProperty('--baseline-position',start+'%');
  button.style.setProperty('--ink',change<0?'#ab503e':change>0?'#186b6c':'#697678');
  button.innerHTML='<span class="endpoint-caption"><strong>'+esc(titleCase(row.name))+'</strong><small>'+esc(money(row.a))+' → '+esc(money(row.b))+'</small></span><span class="endpoint-track" aria-hidden="true"><i class="endpoint-line" style="left:'+Math.min(start,end)+'%;width:'+Math.abs(start-end)+'%"></i><i class="endpoint-before" style="left:'+start+'%"></i><i class="endpoint-after" style="left:'+end+'%"></i></span><b>'+esc(signed(change))+'</b>';
  button.onclick=()=>onSelect(row);
  grid.append(button);
 }
}
function render(){const h=host(),src=group==='recipient'?recipientRows:unit.programs,rows=pairs(filtered(src).map(r=>({...r,grantSubject:taxonomy[r.program_code]?.subject||'Purpose unresolved'})),group==='subject'?'grantSubject':group==='sector'?'sector':group==='program'?'program_code':'recipient_id',group==='subject'?'grantSubject':group==='sector'?'sector':group==='program'?'program_name':'recipient_name'),all=filtered(unit.programs),a=all.filter(r=>r.year===2024).reduce((s,r)=>s+(r.amount||0),0),b=all.filter(r=>r.year===2026).reduce((s,r)=>s+(r.amount||0),0),largest=[...rows].sort((a,b)=>b.b-a.b)[0],topics=[...new Set(unit.sectors.map(r=>r.topic_code))].sort();h.innerHTML='<div class="section-heading"><div><p class="eyebrow">Follow resources beyond government</p><h2>Who receives the funding?</h2><p>'+esc(unit.name)+' · full FY2024 → full FY2026</p></div><button class="outline" id="outbound-all">All government →</button></div><div class="outbound-controls"><label>Agency role<select id="outbound-basis"><option value="funding" '+(basis==='funding'?'selected':'')+'>Funding agency · whose resources</option><option value="awarding" '+(basis==='awarding'?'selected':'')+'>Awarding agency · who issued it</option></select></label><label>Award type<select id="outbound-kind">'+['all','Grants / cooperative agreements','Contracts','Other assistance','Loan subsidy cost'].map(x=>'<option '+(kind===x?'selected':'')+' value="'+esc(x)+'">'+(x==='all'?'All reported awards':x)+'</option>').join('')+'</select></label><label>Topic<select id="outbound-topic"><option value="all">All purposes</option><option value="environment" '+(topic==='environment'?'selected':'')+'>Environment & climate · title lens</option>'+topics.map(t=>'<option value="'+esc(t)+'" '+(topic===t?'selected':'')+'>'+esc(t==='unallocated'?'Unallocated / mixed account references':t)+'</option>').join('')+'</select></label><label>Show<select id="outbound-group">'+[['subject','Grant subjects → subsubjects (listings)'],['sector','Recipient sectors'],['program','Assistance programs / contract purposes'],['recipient','Recipients']].map(([id,n])=>'<option value="'+id+'" '+(group===id?'selected':'')+'>'+n+'</option>').join('')+'</select></label></div><div class="investigation-metrics"><article><span>FY2024 net award obligations</span><b>'+money(a)+'</b></article><article><span>FY2026 net award obligations</span><b>'+money(b)+'</b></article><article><span>Change</span><b>'+signed(b-a)+'</b></article></div><p class="scope-note">'+(largest?esc(largest.name)+' is the largest displayed allocation in FY2026 ('+money(largest.b)+'). ':'')+'These are transaction obligations, including negative adjustments, rather than award ceilings or repeated lifetime totals. Full fiscal-year awards use a different period from the October–August account-spending comparison above.</p><div class="bubble-breadcrumb"><button id="outbound-root">All recipient sectors</button>'+(subject!=='all'?'<span>› '+esc(subject)+'</span>':'')+(sector?'<span>› '+esc(sector)+'</span>':'')+(program?'<span>› Program '+esc(program)+'</span>':'')+'</div><div class="comparison-legend"><span><i style="background:#b65e4d"></i>Decrease</span><span><i style="background:#277c80"></i>Increase</span><span><i style="background:#879496"></i>Unchanged</span></div><p class="muted">Select a sector to explore its programs, then a program to see recipients. Largest 20 changes are visualized; the table and export include all matching aggregates.</p><div id="outbound-bubbles" class="allocation-host"></div><p id="outbound-selection" aria-live="polite"></p><label>Find a '+(group==='recipient'?'recipient':'program or sector')+'<input id="outbound-search" type="search" value="'+esc(query)+'"></label><div class="table-scroll"><table><thead><tr><th>'+ (group==='subject'?'Grant subject':group==='sector'?'Recipient sector':group==='program'?'Assistance program / contract purpose':'Recipient')+'</th><th>FY2024</th><th>FY2026</th><th>Change</th></tr></thead><tbody>'+rows.slice(0,limit).map((r,i)=>'<tr><td><button class="agency-link" data-outbound-row="'+i+'">'+esc(r.name)+'</button><small>'+esc(r.id)+'</small></td><td>'+money(r.a)+'</td><td>'+money(r.b)+'</td><td>'+signed(r.b-r.a)+'</td></tr>').join('')+'</tbody></table></div><div class="table-footer"><span>'+Math.min(limit,rows.length)+' of '+rows.length+' matching groups</span>'+(limit<rows.length?'<button class="outline" id="outbound-more">Show more</button>':'')+'<button class="outline" id="outbound-export">Export allocation ↓</button></div><details><summary>Sources, classification and coverage</summary><p>'+esc(index.source_vintage)+'. '+esc(index.definition)+'</p><p>'+esc(index.sector_basis)+'</p><p>'+esc(index.topic_basis)+'</p><p>Grant subjects use documented listing-title rules, with a unique account-purpose fallback. Each named Assistance Listing is its program-level subsubject. Unresolved purposes remain visible. <a href="data/grant-subjects.json">Download the classification crosswalk</a>. Contract purposes use Product or Service Codes, which are not grant programs. Recipient detail shows the ten largest recipient amounts per program, year and agency role; every remaining dollar is retained as Other recipients. Individual names are not published. Missing comparison-year transactions are zero in this archive comparison; they do not prove a program was canceled.</p><p>“Grants and fixed charges” in the budget includes items beyond grants. Award records and account obligations have different scopes and are not expected to reconcile without additional adjustments. State and local pass-through awards, undisclosed recipients and subsequent subawards are not a complete ultimate-beneficiary ledger.</p><a href="https://www.usaspending.gov/download_center/award_data_archive">Official award archives ↗</a> · <a href="data/outbound-awards.json">Source receipts and methodology ↓</a></details>';
 grantFlow();
 renderAwardGraphic(rows, select);

 document.getElementById('outbound-basis').onchange=e=>{basis=e.target.value;render()};document.getElementById('outbound-kind').onchange=e=>{kind=e.target.value;subject='all';sector='';program='';group='sector';render()};document.getElementById('outbound-topic').onchange=e=>{topic=e.target.value;render()};document.getElementById('outbound-group').onchange=e=>{group=e.target.value;subject='all';if(group==='subject')kind='Grants / cooperative agreements';program='';sector='';query='';group==='recipient'?recipients():render()};document.getElementById('outbound-all').onclick=()=>{sector='';program='';group='sector';load('ALL')};document.getElementById('outbound-root').onclick=()=>{sector='';program='';group='sector';subject='all';query='';render()};document.getElementById('outbound-search').oninput=e=>{const pos=e.target.selectionStart;query=e.target.value;render();const input=document.getElementById('outbound-search');input.focus();input.setSelectionRange(pos,pos)};h.querySelectorAll('[data-outbound-row]').forEach(el=>el.onclick=()=>select(rows[+el.dataset.outboundRow]));if(document.getElementById('outbound-more'))document.getElementById('outbound-more').onclick=()=>{limit+=100;render()};document.getElementById('outbound-export').onclick=()=>{const quote=x=>'"'+String(x??'').replace(/"/g,'""')+'"',csv=[['identifier','name','FY2024_net_obligations','FY2026_net_obligations','change'],...rows.map(r=>[r.id,r.name,r.a,r.b,r.b-r.a])].map(r=>r.map(quote).join(',')).join('\r\n'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})),a=document.createElement('a');a.href=url;a.download=code+'-external-awards.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}}
window.addEventListener('atlas-filter-outbound',e=>{topic=e.detail.topic;basis='funding';kind='all';group='sector';sector='';program='';if(unit)render()});window.addEventListener('atlas-uses-ready',e=>{sector='';program='';group='sector';topic='all';subject='all';load(e.detail.code)});window.addEventListener('atlas-show-grants',()=>{subject='all';kind='Grants / cooperative agreements';basis='awarding';sector='';program='';group='program';if(unit)render();host().scrollIntoView({behavior:'smooth',block:'start'})});
})();
