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
 function focusFunding(topicCode,metric){
  window.dispatchEvent(new CustomEvent('atlas-focus-funding',{detail:{topic:topicCode,metric:metric}}));
 }

 Promise.all(['repair-bill','workforce-restoration','budget-structure'].map(n=>fetch('data/'+n+'.json').then(r=>{if(!r.ok)throw Error(n);return r.json()})))
 .then(([bill,det,budget])=>render(bill,det,budget))
 .catch(()=>{root.innerHTML='';});

 function render(bill,det,budget){
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
    .sort((a,b)=>a.pct-b.pct).slice(0,9)
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
      '<span class="rc-meta">'+num(r.baseline)+' → '+num(r.latest)+' · '+num(r.net)+' positions · '+(r.seasonal?'year-over-year<sup class="role-fn" data-seasonal-note role="link" tabindex="0" aria-label="Why measured year over year? See note at the bottom">†</sup> · ':'')+'explore →</span></button>').join('')+
    '</div></div>').join('');
  const sn=bill.seasonal_note;
  const seasonalNote=sn?'<p class="seasonal-note" id="seasonal-note"><b>A note on seasonal work.</b> A few agencies staff up for the summer, so the September snapshot flatters them. The '+esc(sn.agency)+' as a whole looks roughly flat since December 2024 ('+(sn.headline_pct>=0?'+':'−')+Math.abs(sn.headline_pct).toFixed(0)+'%) but is down <b>'+Math.abs(sn.yoy_pct).toFixed(0)+'%</b> year over year ('+esc(sn.yoy_label)+', the same season). The cuts are real — just masked by seasonal hiring — so the park ranger card above is measured year over year, not against the summer peak. (Wildland-fire crews are seasonal too; measured the same way their numbers held roughly flat, so they are not shown as a cut.)</p>':'';

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

  // ---- actual cash: net outlays that stopped flowing ----
  let cashSection='';
  if(f.outlays&&f.outlays.cut_topics&&f.outlays.cut_topics.length){
   const o=f.outlays;
   const ocuts=o.cut_topics.filter(t=>!/mixed purpose|unclassified/i.test(t.topic)).slice(0,5);
   const omax=Math.max(1,...ocuts.map(t=>Math.abs(t.amount)));
   const obars=ocuts.map(t=>'<button class="priority-bar" '+(t.topic_code?'data-topic-code="'+esc(t.topic_code)+'" data-metric="net_outlays"':'disabled')+'>'+
     '<span class="pb-name">'+esc(t.topic)+'</span>'+
     '<span class="pb-track"><i style="width:'+(Math.abs(t.amount)/omax*100)+'%"></i></span>'+
     '<span class="pb-val">−'+money(Math.abs(t.amount))+'</span></button>').join('');
   const surge=(o.surge_topics||[]).slice(0,3).map(t=>esc(t.topic)+' (+'+money(t.amount)+')').join(', ');
   cashSection='<section class="priorities">'+
    '<h2>The cash that actually stopped flowing</h2>'+
    '<p class="section-lede"><b>Outlays</b> are cash payments. Total outlays rose '+(o.total_pct!=null?o.total_pct.toFixed(0)+'%':'')+' — but that hides where money stopped reaching people. These services saw the sharpest drop in real payments, FY2024 to FY2026.</p>'+
    '<div class="priority-bars">'+obars+'</div>'+
    (surge?'<p class="priority-contrast">The rise went almost entirely to mandatory programs and interest — '+surge+' — not to the services above. <button class="link-btn" data-explore-funding>See the full funding picture →</button></p>':'')+
   '</section>';
  }

  // ---- the budget's structure: mandatory vs discretionary, and the debt ----
  let budgetSection='';
  if(budget&&budget.categories&&budget.categories.length){
   const cm={};budget.categories.forEach(c=>cm[c.name]=c);
   const disc=cm['Discretionary'],mand=cm['Mandatory'],ni=cm['Net interest'];
   const color={'Mandatory':'#6b7f88','Discretionary':'#43838b','Net interest':'#c27a4e'};
   const stackRow=(label,key,total)=>'<div class="bud-stack"><span class="bud-year">'+label+'</span><span class="bud-bar">'+
     budget.categories.map(c=>{const pct=c[key]/total*100;return '<span class="bud-seg" style="width:'+pct+'%;background:'+color[c.name]+'">'+(pct>11?'<span class="bud-seg-lbl">'+pct.toFixed(0)+'%</span>':'')+'</span>';}).join('')+'</span></div>';
   // net-interest trajectory on the presidential-election cycle
   const tr=budget.net_interest_trend.filter(d=>[2016,2020,2024,2026].includes(d.year));
   const W=360,H=118,L=5,R=5,Tp=14,Bm=24;
   const maxY=Math.max(...tr.map(d=>d.amount))*1.08,sx=i=>L+i/(tr.length-1)*(W-L-R),sy=v=>Tp+(1-v/maxY)*(H-Tp-Bm);
   const pts=tr.map((d,i)=>sx(i)+','+sy(d.amount)).join(' ');
   const spark='<svg viewBox="0 0 '+W+' '+H+'" class="interest-spark" role="img" aria-label="Net interest on the national debt by presidential-election year">'+
     '<polyline points="'+pts+'" fill="none" stroke="#19354a" stroke-width="2.5"/>'+
     tr.map((d,i)=>'<circle cx="'+sx(i)+'" cy="'+sy(d.amount)+'" r="3.5" fill="#19354a"/><text x="'+sx(i)+'" y="'+(H-9)+'" text-anchor="'+(i===0?'start':i===tr.length-1?'end':'middle')+'" font-size="10" fill="#5d727b">'+d.year+'</text><text x="'+sx(i)+'" y="'+(sy(d.amount)-8)+'" text-anchor="'+(i===tr.length-1?'end':i===0?'start':'middle')+'" font-size="10" font-weight="600" fill="#19354a">'+money(d.amount)+'</text>').join('')+'</svg>';
   const dc=budget.discretionary.cuts.slice(0,6),dmax=Math.max(1,...dc.map(c=>Math.abs(c.amount)));
   const dbars=dc.map(c=>'<div class="disc-row"><span class="disc-name">'+esc(c.function)+'</span><span class="disc-track"><i style="width:'+(Math.abs(c.amount)/dmax*100)+'%"></i></span><span class="disc-val">−'+money(Math.abs(c.amount))+'</span></div>').join('');
   budgetSection='<section class="budget-structure">'+
    '<h2>Discretionary spending fell from '+disc.share_a.toFixed(0)+'% to '+disc.share_b.toFixed(0)+'% of the budget</h2>'+
    '<p class="section-lede">Three of every four federal dollars aren’t decided each year. <b>Mandatory</b> programs — Social Security, Medicare, Medicaid — run on autopilot ('+mand.share_b.toFixed(0)+'% of the budget). <b>Debt interest</b> takes another '+ni.share_b.toFixed(0)+'%. Only about a quarter is <b>discretionary</b> — what Congress actually chooses — and that share is shrinking.</p>'+
    '<div class="bud-stacks"><div class="bud-legend">'+budget.categories.map(c=>'<span><i style="background:'+color[c.name]+'"></i>'+esc(c.name)+'</span>').join('')+'</div>'+
     stackRow('FY2024','a',budget.total.a)+stackRow('FY2026','b',budget.total.b)+
     '<p class="muted">'+money(disc.a)+' to '+money(disc.b)+' ('+disc.pct.toFixed(0)+'%), squeezed by growing mandatory programs and debt interest.</p></div>'+
    '<div class="budget-grid">'+
     '<div class="debt-panel"><h3>The national debt’s interest grew '+ni.pct.toFixed(0)+'% from 2024 to 2026</h3>'+
      '<p class="chart-note">Net interest more than quadrupled since 2016, past <b>'+money(ni.b)+'</b> — more than any discretionary function. Election-cycle years.</p>'+spark+'</div>'+
     '<div class="disc-panel"><h3>The cuts Congress chose</h3>'+
      '<p class="chart-note">Largest discretionary cuts, FY2024 → FY2026.</p>'+dbars+'</div></div>'+
    '<p class="muted">'+esc(budget.basis)+'</p>'+
   '</section>';
  }

  root.innerHTML=
  '<section class="repair-hero">'+
   '<p class="eyebrow">The federal workforce · December 2024 → September 2026</p>'+
   '<h1>To <span class="hl-build">build back better</span>, we must first know what was <span class="hl-demo">demolished</span>.</h1>'+
   '<p class="lede">In under two years, the non-defense federal workforce was <b>hollowed out</b> by <b>'+num(-p.net_change)+'</b> positions — a <b>'+Math.abs(pct).toFixed(0)+'%</b> reduction. People were fired, took buyouts, resigned under pressure or had their jobs eliminated. The losses fell hardest on the most experienced civil servants and erased entire agencies. This is what it would take to rebuild.</p>'+
   '<div class="repair-tiles">'+
    tile('People to rehire',num(p.positions_to_restore),'Rebuild each career field at its former mix of pay grades.','Net declines by occupation and grade; excludes defense.')+
    tile('Annual payroll to rebuild',money(p.loaded_payroll)+'/yr',"Baseline salaries matched to each occupation and pay grade.",'Base pay '+money(p.base_payroll)+', plus benefits and overhead.')+
    tile('Funding to restore',money(domestic),'To reverse the domestic funding cuts'+(heroTopics?': '+heroTopics+'.':'.'),'Domestic funding cut, FY2024 to FY2026, outside defense.')+
   '</div>'+
  '</section>'+
  '<section class="service-people">'+
   '<h2>Cutting core services that Americans rely on</h2>'+
   '<p class="section-lede">Inspectors, scientists and specialists lost from public service. Most cards compare December 2024 with September 2026; † marks a same-season comparison. Select a role to explore its agency.</p>'+
   serviceGroups+
  '</section>'+
  '<section class="demolition">'+
   '<h2>The reductions were not spread evenly</h2>'+
   '<p class="section-lede">Compare losses by pay grade and agency. Select an agency to explore its record.</p>'+
   '<div class="demolition-grid">'+
    '<div class="grade-chart"><h3>The experience drain, by GS grade</h3>'+
     '<p class="chart-note">Change by pay grade, outside defense. The senior ranks (GS-13 to 15) alone lost <b>'+num(-senior)+'</b> people.</p>'+
     '<div class="grade-bars">'+gradeBars+'</div>'+
     '<div class="grade-axis">← fewer employees</div></div>'+
    '<div class="agency-casualties"><h3>Agencies hollowed out</h3>'+cas+'</div>'+
   '</div>'+
  '</section>'+
  budgetSection+
  cashSection+
  '<p class="repair-cta">Explore the records behind the headlines ↓</p>';

  // ---- footnotes collected at the very bottom of the page ----
  const methodDetails='<details class="repair-method"><summary>How the repair-bill figures are built</summary>'+
   '<p>'+esc(det.methodology.target)+' '+esc(det.methodology.positions)+' '+esc(det.methodology.cost)+'</p>'+
   '<p>'+esc(det.methodology.salary_imputation)+' Salaries are reported for '+det.salary_coverage.reported_pct+'% of non-defense staff. '+esc(det.methodology.defense)+'</p>'+
   '<p>'+esc(det.methodology.caveats)+' '+esc(f.basis)+' * marks an occupation whose average salary was imputed.</p></details>';
  const pageNotes=document.getElementById('page-notes');
  if(pageNotes){pageNotes.querySelector('#rebuild-notes')?.remove();
   pageNotes.insertAdjacentHTML('beforeend','<div id="rebuild-notes" class="note-block">'+methodDetails+seasonalNote+'</div>');}

  // ---- wire drill-downs ----
  root.querySelectorAll('[data-agency-code]').forEach(el=>el.addEventListener('click',()=>focusWorkforce(el.dataset.agencyCode)));
  root.querySelectorAll('[data-seasonal-note]').forEach(el=>{const go=e=>{e.stopPropagation();e.preventDefault();document.getElementById('seasonal-note')?.scrollIntoView({behavior:'smooth',block:'center'})};el.addEventListener('click',go);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')go(e)})});
  root.querySelectorAll('[data-topic-code]').forEach(el=>el.addEventListener('click',()=>focusFunding(el.dataset.topicCode,el.dataset.metric)));
  root.querySelector('[data-explore-funding]')?.addEventListener('click',()=>focusFunding('all'));
  root.querySelectorAll('[data-opm]').forEach(el=>el.addEventListener('click',()=>{
    window.dispatchEvent(new CustomEvent('atlas-open-uses',{detail:{opmId:el.dataset.opm}}));
    document.querySelector('[data-project-panel="uses"]')?.scrollIntoView({behavior:'smooth',block:'start'});
  }));
 }

 function tile(label,figure,sub,foot){
  return '<div class="repair-tile"><div class="tile-label">'+esc(label)+'</div>'+
   '<div class="tile-figure">'+esc(figure)+'</div>'+
   '<div class="tile-sub">'+sub+'</div><div class="tile-foot">'+esc(foot)+'</div></div>';
 }
})();
