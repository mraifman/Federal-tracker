/* The repair bill: what the cuts demolished and what rebuilding would take.
   Reads data/repair-bill.json (top-line people + funding) and
   data/workforce-restoration.json (grade, occupation and agency detail).
   Cards drill into the existing workforce and funding investigations. */
(()=>{'use strict';
 const root=document.getElementById('repair-hero');
 if(!root)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const num=n=>Math.round(n).toLocaleString('en-US');
 const money=n=>{const v=Math.abs(n),d=v>=1e12?1e12:v>=1e9?1e9:v>=1e6?1e6:1;return (n<0?'−':'')+'$'+(v/d).toLocaleString('en-US',{maximumFractionDigits:d===1?0:v/d>=100?0:1})+({1:'',1e6:'M',1e9:'B',1e12:'T'}[d]);};
 const title=s=>String(s).toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()).replace(/\b(Usda|Nih|Cdc|Fda|Epa|Irs|Fbi|Sba|Nasa|Nsf|Usaid|U\.s\.)\b/gi,c=>c.toUpperCase());

 function focusWorkforce(code){
  if(!code)return;
  window.dispatchEvent(new CustomEvent('atlas-focus-workforce',{detail:{department:code}}));
  document.querySelector('[data-project-tab="workforce"]')?.click();
  document.querySelector('[data-project-panel="workforce"]')?.scrollIntoView({behavior:'smooth',block:'start'});
 }
 function focusFunding(topicCode){
  window.dispatchEvent(new CustomEvent('atlas-focus-funding',{detail:{topic:topicCode}}));
 }

 Promise.all(['repair-bill','workforce-restoration'].map(n=>fetch('data/'+n+'.json').then(r=>{if(!r.ok)throw Error(n);return r.json()})))
 .then(([bill,det])=>render(bill,det))
 .catch(()=>{root.innerHTML='';});

 function render(bill,det){
  const p=bill.people,f=bill.funding;
  const pct=(p.net_change/p.baseline_count*100);

  // ---- GS grade losses ----
  const gs=det.by_grade.filter(g=>g.pay_plan==='GS'&&/^(0?[1-9]|1[0-5])$/.test(g.grade))
    .map(g=>({grade:+g.grade,net:g.net})).sort((a,b)=>a.grade-b.grade);
  const gmax=Math.max(1,...gs.map(g=>Math.abs(g.net)));
  const senior=gs.filter(g=>g.grade>=13).reduce((s,g)=>s+g.net,0);
  const gradeBars=gs.map(g=>{
    const w=Math.abs(g.net)/gmax*100,pos=g.net>0;
    return '<div class="grade-row"><span class="g-name">GS-'+String(g.grade).padStart(2,'0')+'</span>'+
      '<span class="g-track"><i class="g-fill'+(pos?' pos':'')+'" style="width:'+(w/2)+'%"></i></span>'+
      '<span class="g-val'+(pos?' pos':'')+'">'+(g.net>0?'+':'−')+num(Math.abs(g.net))+'</span></div>';
  }).join('');

  // ---- hardest-hit agencies (flagship destructions by %, meaningful size) ----
  const cas=det.by_agency.filter(a=>a.baseline>=400&&a.net<0&&a.pct!=null)
    .sort((a,b)=>a.pct-b.pct).slice(0,6)
    .map(a=>'<button class="casualty" data-agency-code="'+esc(a.code)+'"><span class="c-name">'+esc(title(a.name))+'</span>'+
      '<span class="c-pct">'+a.pct.toFixed(0)+'%</span>'+
      '<span class="c-detail">'+num(a.baseline)+' → '+num(a.latest)+' · '+num(a.net)+' positions · explore →</span></button>').join('');

  // ---- curated federal roles that touch daily life ----
  const roles=bill.service_roles||[];
  const cats=[];
  roles.forEach(r=>{let g=cats.find(c=>c.name===r.category);if(!g){g={name:r.category,items:[]};cats.push(g)}g.items.push(r)});
  const serviceGroups=cats.map(c=>'<div class="role-category"><h3>'+esc(c.name)+'</h3><div class="role-grid">'+
    c.items.map(r=>'<button class="role-card" data-agency-code="'+esc(r.agency)+'">'+
      '<span class="rc-top"><span class="rc-name">'+esc(r.label)+'</span><span class="rc-pct">'+(r.pct<=0?'−':'+')+Math.abs(r.pct).toFixed(0)+'%</span></span>'+
      '<span class="rc-desc">'+esc(r.description)+'</span>'+
      '<span class="rc-meta">'+num(r.baseline)+' → '+num(r.latest)+' · '+num(r.net)+' positions · '+(r.seasonal?'year-over-year · ':'')+'explore →</span></button>').join('')+
    '</div></div>').join('');
  const sn=bill.seasonal_note;
  const seasonalNote=sn?'<p class="seasonal-note"><b>A note on seasonal work.</b> A few agencies staff up for the summer, so the September snapshot flatters them. The '+esc(sn.agency)+' as a whole looks roughly flat since December 2024 ('+(sn.headline_pct>=0?'+':'−')+Math.abs(sn.headline_pct).toFixed(0)+'%) but is down <b>'+Math.abs(sn.yoy_pct).toFixed(0)+'%</b> year over year ('+esc(sn.yoy_label)+', the same season). The cuts are real — just masked by seasonal hiring — so the park ranger card above is measured year over year, not against the summer peak; wildland-fire staffing shows the same pattern.</p>':'';

  // ---- funding: cut topics to restore (exclude Defense from the domestic frame) ----
  const cuts=f.top_cut_topics.filter(t=>!/^defense$/i.test(t.topic));
  const defense=(f.top_cut_topics.find(t=>/^defense$/i.test(t.topic))||{}).amount||0;
  const domestic=f.restore_total-defense;
  const cmax=Math.max(1,...cuts.map(t=>t.amount));
  const cutBars=cuts.slice(0,6).map(t=>'<button class="priority-bar" '+(t.topic_code?'data-topic-code="'+esc(t.topic_code)+'"':'disabled')+'>'+
    '<span class="pb-name">'+esc(t.topic)+'</span>'+
    '<span class="pb-track"><i style="width:'+(t.amount/cmax*100)+'%"></i></span>'+
    '<span class="pb-val">'+money(t.amount)+'</span></button>').join('');
  const grew=f.top_increase_topics.slice(0,3).map(t=>esc(t.topic)+' ('+money(t.amount)+')').join(', ');
  const heroTopics=cuts.slice(0,3).map(t=>esc(t.topic)+' ('+money(t.amount)+')').join(', ');

  root.innerHTML=
  '<section class="repair-hero">'+
   '<p class="eyebrow">The federal workforce · December 2024 → September 2026</p>'+
   '<h1>To build back better, we must first know what was demolished.</h1>'+
   '<p class="lede">In under two years, Republican leaders in Washington cut <b>'+num(-p.net_change)+'</b> non-defense federal jobs — a <b>'+Math.abs(pct).toFixed(0)+'%</b> reduction that fell hardest on the most experienced civil servants and erased entire agencies. This is what it would take to rebuild.</p>'+
   '<div class="repair-tiles">'+
    tile('People to rehire',num(p.positions_to_restore),'To return every career field to its December 2024 strength.','Sum of per-occupation net losses, non-defense.')+
    tile('Annual payroll to rebuild',money(p.loaded_payroll)+'/yr',"Priced at the actual grades and salaries of the roles that were cut.",'Base pay '+money(p.base_payroll)+', loaded ×1.33 for benefits & overhead.')+
    tile('Program funding to restore',money(domestic),'To reverse the cuts to domestic public services'+(heroTopics?': '+heroTopics+'.':'.'),'Decreases in reported net budget authority, FY2024→FY2026, excluding defense.')+
   '</div>'+
  '</section>'+
  '<section class="service-people">'+
   '<h2>The people behind the services</h2>'+
   '<p class="section-lede">Every cut is a person who did a job Americans rely on. Each of these is a real federal occupational series, thinned between December 2024 and September 2026. Select any role to open its agency.</p>'+
   serviceGroups+seasonalNote+
  '</section>'+
  '<section class="demolition">'+
   '<h2>What was demolished</h2>'+
   '<p class="section-lede">The reductions were not spread evenly. They concentrated in senior, experienced grades — institutional knowledge that takes years to rebuild — and gutted specific agencies to the point of collapse. Select any agency or role to open its full record.</p>'+
   '<div class="demolition-grid">'+
    '<div class="grade-chart"><h3>The experience drain, by GS grade</h3>'+
     '<p class="chart-note">Net change in non-defense staff at each General Schedule grade. Senior ranks (GS-13 to 15) lost <b>'+num(-senior)+'</b> people.</p>'+
     '<div class="grade-bars">'+gradeBars+'</div>'+
     '<div class="grade-axis">← fewer employees</div></div>'+
    '<div class="agency-casualties"><h3>Agencies hollowed out</h3>'+cas+'</div>'+
   '</div>'+
  '</section>'+
  '<section class="priorities">'+
   '<h2>What they stopped funding</h2>'+
   '<p class="section-lede">The demolition was not only people. Reversing the FY2024→FY2026 cuts to domestic functions would take <b>'+money(domestic)+'</b> in restored budget authority. Select a function to open its accounts.</p>'+
   '<div class="priority-bars">'+cutBars+'</div>'+
   '<p class="priority-contrast">Total federal budget authority still <b>rose '+money(f.fy2026_total-f.fy2024_total)+'</b> net over the same period — but that growth is mandatory, led by '+grew+' — not a restoration of these services. '+
    '<button class="link-btn" data-explore-funding>See the full funding picture →</button></p>'+
  '</section>'+
  '<p class="repair-cta">Explore the full evidence — headcount, funding and where the money goes — below ↓</p>'+
  '<details class="repair-method"><summary>How these figures are built</summary>'+
   '<p>'+esc(det.methodology.target)+' '+esc(det.methodology.positions)+' '+esc(det.methodology.cost)+'</p>'+
   '<p>'+esc(det.methodology.salary_imputation)+' Salaries are reported for '+det.salary_coverage.reported_pct+'% of non-defense staff. '+esc(det.methodology.defense)+'</p>'+
   '<p>'+esc(det.methodology.caveats)+' '+esc(f.basis)+' * marks an occupation whose average salary was imputed.</p></details>';

  // ---- wire drill-downs ----
  root.querySelectorAll('[data-agency-code]').forEach(el=>el.addEventListener('click',()=>focusWorkforce(el.dataset.agencyCode)));
  root.querySelectorAll('[data-topic-code]').forEach(el=>el.addEventListener('click',()=>focusFunding(el.dataset.topicCode)));
  root.querySelector('[data-explore-funding]')?.addEventListener('click',()=>focusFunding('all'));
 }

 function tile(label,figure,sub,foot){
  return '<div class="repair-tile"><div class="tile-label">'+esc(label)+'</div>'+
   '<div class="tile-figure">'+esc(figure)+'</div>'+
   '<div class="tile-sub">'+sub+'</div><div class="tile-foot">'+esc(foot)+'</div></div>';
 }
})();
