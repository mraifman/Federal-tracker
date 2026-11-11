/* Historical staffing and funding changes, with descriptive benchmark estimates.
   Reads data/repair-bill.json (top-line people + funding) and
   data/workforce-restoration.json (grade, occupation and agency detail).
   Cards drill into the existing workforce and funding investigations. */
(()=>{'use strict';
 const root=document.getElementById('repair-hero');
 if(!root)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const num=n=>Math.round(n).toLocaleString('en-US');
 const money=n=>{const v=Math.abs(n),d=v>=1e12?1e12:v>=1e9?1e9:v>=1e6?1e6:1;return (n<0?'−':'')+'$'+(v/d).toLocaleString('en-US',{maximumFractionDigits:d===1?0:v/d>=100?0:1})+({1:'',1e6:'M',1e9:'B',1e12:'T'}[d]);};
 const title=s=>window.AtlasChartTools.displayName(s);

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
      '<span class="rc-meta">'+num(r.baseline)+' → '+num(r.latest)+' · '+num(r.net)+' employees · '+(r.seasonal?'year-over-year<sup class="role-fn" data-seasonal-note role="link" tabindex="0" aria-label="Why measured year over year? See note at the bottom">†</sup> · ':'')+'explore →</span></button>').join('')+
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
    '<h2>Where cash payments fell</h2>'+
    '<p class="section-lede"><b>Outlays</b> are cash payments. Total payments rose '+(o.total_pct!=null?o.total_pct.toFixed(0)+'%':'')+' overall. These topics had the largest declines, FY2024 to FY2026.</p>'+
    '<div class="priority-bars">'+obars+'</div>'+
    (surge?'<p class="priority-contrast">The rise went almost entirely to mandatory programs and interest — '+surge+' — not to the services above. <button class="link-btn" data-explore-funding>Explore funding priorities →</button></p>':'')+
   '</section>';
  }

  // ---- the budget's structure: mandatory vs discretionary, and the debt ----
  let budgetSection='';
  if(budget&&budget.choices&&budget.choices.categories&&budget.choices.categories.length){
   const ch=budget.choices,cats=ch.categories,tot=ch.total,by={};cats.forEach(c=>by[c.name]=c);
   const ent=by['Entitlement benefit programs'],ni=by['Net interest on the debt'],choices=by['Funding choices'];
   const omb={};(budget.categories||[]).forEach(c=>omb[c.name]=c);const niTrend=omb['Net interest']||{};
   const color={'Entitlement benefit programs':'#6b7f88','Net interest on the debt':'#c27a4e','Self-financed funds':'#aeb8c8','Funding choices':'#43838b'};
   const stackRow=(label,key)=>'<div class="bud-stack"><span class="bud-year">'+label+'</span><span class="bud-bar">'+cats.map(c=>{const pct=c[key]/tot[key]*100;return '<span class="bud-seg" style="width:'+pct+'%;background:'+color[c.name]+'" title="'+esc(c.name)+' · '+pct.toFixed(1)+'%">'+(pct>11?'<span class="bud-seg-lbl">'+pct.toFixed(0)+'%</span>':'')+'</span>';}).join('')+'</span></div>';
   // net-interest trajectory on the presidential-election cycle (OMB budget database)
   const tr=(budget.net_interest_trend||[]).filter(d=>[2016,2020,2024,2026].includes(d.year));
   let spark='';
   if(tr.length>1){const W=360,H=118,L=5,R=5,Tp=24,Bm=24,maxY=Math.max(...tr.map(d=>d.amount))*1.08,sx=i=>L+i/(tr.length-1)*(W-L-R),sy=v=>Tp+(1-v/maxY)*(H-Tp-Bm),pts=tr.map((d,i)=>sx(i)+','+sy(d.amount)).join(' ');
    spark='<svg viewBox="0 0 '+W+' '+H+'" class="interest-spark" role="img" aria-label="Net interest on the national debt by presidential-election year"><polyline points="'+pts+'" fill="none" stroke="#102d52" stroke-width="2.5"/>'+tr.map((d,i)=>'<circle cx="'+sx(i)+'" cy="'+sy(d.amount)+'" r="3.5" fill="#102d52"/><text x="'+sx(i)+'" y="'+(H-9)+'" text-anchor="'+(i===0?'start':i===tr.length-1?'end':'middle')+'" font-size="10" fill="#5d727b">'+d.year+'</text><text x="'+sx(i)+'" y="'+(sy(d.amount)-8)+'" text-anchor="'+(i===tr.length-1?'end':i===0?'start':'middle')+'" font-size="10" font-weight="600" fill="#102d52">'+money(d.amount)+'</text>').join('')+'</svg>';}
   const bars=(list,cls)=>{const mx=Math.max(1,...list.map(c=>Math.abs(c.amount)));return list.map(c=>'<div class="disc-row '+cls+'"><span class="disc-name">'+esc(c.topic)+'</span><span class="disc-track"><i class="'+cls+'" style="width:'+(Math.abs(c.amount)/mx*100)+'%"></i></span><span class="disc-val">'+(c.amount<0?'−':'+')+money(Math.abs(c.amount))+'</span></div>').join('')};
   const pct=(choices.b/choices.a-1)*100,cuts=ch.cuts.filter(c=>Math.abs(c.amount)>=1e9),adds=ch.adds.filter(c=>c.amount>=1e9);
   budgetSection='<section class="budget-structure">'+
    '<h2>The share of resources for non-entitlement spending is shrinking</h2>'+
    '<p class="section-lede">Entitlement benefit programs — Social Security, Medicare, Medicaid and similar — required <b>'+ent.share_b.toFixed(0)+'%</b> of what the government committed in FY2026, up from '+ent.share_a.toFixed(0)+'% in FY2024.</p>'+
    '<div class="bud-stacks"><div class="bud-legend">'+cats.map(c=>'<span><i style="background:'+color[c.name]+'"></i>'+esc(c.name)+'</span>').join('')+'</div>'+
     stackRow('FY2024','a')+stackRow('FY2026','b')+
     '<p class="muted">Funding choices: '+money(choices.a)+' to '+money(choices.b)+' committed ('+(pct>0?'+':'')+pct.toFixed(0)+'%); entitlements and interest grew faster.</p></div>'+
    '<div class="budget-grid">'+
     '<div class="debt-panel"><h3>The national debt’s interest grew '+(niTrend.pct!=null?niTrend.pct.toFixed(0)+'% ':'')+'from 2024 to 2026</h3>'+
      '<p class="chart-note">Net interest more than quadrupled since 2016, past <b>'+money(niTrend.b||ni.b)+'</b> — more than any single funding choice. Election-cycle years.</p>'+spark+'</div>'+
     '<div class="disc-panel"><h3>Largest reductions in funding choices</h3><p class="chart-note">Obligations, FY2024 → FY2026.</p>'+bars(cuts,'')+
      '</div></div>'+
    '<div class="disc-panel funding-increases"><h3>Largest increases in funding choices</h3><p class="chart-note">Obligations, FY2024 → FY2026.</p>'+bars(adds,'gain')+'</div>'+
    (ch.by_topic&&ch.by_topic.length?'<div class="disc-panel choices-totals"><h3>Funds committed in FY2026, by funding choice</h3><p class="chart-note">Obligations within funding choices, largest first; FY2024 and the change shown beneath each amount.</p>'+(()=>{const mx=Math.max(1,...ch.by_topic.map(t=>t.b));return ch.by_topic.map(t=>'<div class="disc-row total"><span class="disc-name">'+esc(t.topic)+'</span><span class="disc-track"><i class="total" style="width:'+(Math.max(0,t.b)/mx*100)+'%"></i></span><span class="disc-val total">'+money(t.b)+'<small>'+money(t.a)+' in FY2024 · '+(t.amount<0?'−':'+')+money(Math.abs(t.amount))+'</small></span></div>').join('')})()+'</div>':'')+
    '<p class="muted">'+esc(ch.basis)+'</p>'+
   '</section>';
  }

  root.innerHTML=
  '<section class="service-people">'+
   '<h2>The people behind public services</h2>'+
   '<p class="section-lede">Changes in the inspectors, scientists and specialists who deliver public services. Most cards compare December 2024 with September 2026; † marks a same-season comparison. Select a role to explore its agency.</p>'+
   serviceGroups+
  '</section>'+
  '<section class="demolition">'+
   '<h2>Agencies and experience hollowed out</h2>'+
   '<div class="demolition-grid">'+
    '<div class="grade-chart"><h3>Change in headcount by pay grade</h3>'+
     '<div class="grade-bars">'+gradeBars+'</div>'+
     '<div class="grade-axis">← fewer employees</div></div>'+
    '<div class="agency-casualties"><h3>Agencies that experienced the largest drop in headcount</h3>'+cas+'</div>'+
   '</div>'+
  '</section>'+
  '';
  const fundingContext=document.getElementById('funding-context');
  if(fundingContext){fundingContext.innerHTML=budgetSection;const methodology=fundingContext.querySelector('.budget-structure>:last-child');if(methodology?.classList.contains('muted'))window.AtlasNotes?.publish('budget-release-method','OMB budget-release context',[methodology]);}

  // ---- footnotes collected at the very bottom of the page ----
  const methodDetails='<div class="repair-method">'+
   '<p>December 2024 is the historical comparison point, not a staffing target. Occupation and pay-grade counts describe reported headcount; promotions, reclassifications and transfers can affect the groups.</p>'+
   '<p>'+esc(det.methodology.defense)+'</p>'+
   '<p>Net headcount changes are not layoff counts. Separations, hiring and transfers are distinct personnel actions. '+esc(f.basis)+'</p>'+
   '<p>'+esc(budget.basis)+' <a href="'+esc(budget.source)+'">OMB FY2027 source release ↗</a> · retrieved '+esc(budget.retrieved_on)+'.</p></div>';
  const pageNotes=document.getElementById('page-notes');
  if(pageNotes){pageNotes.querySelector('#rebuild-notes')?.remove();
   pageNotes.insertAdjacentHTML('beforeend','<details id="rebuild-notes" class="note-block"><summary>Workforce and budget comparison methods</summary>'+methodDetails+seasonalNote+'</details>');}

  // ---- wire drill-downs ----
  root.querySelectorAll('[data-agency-code]').forEach(el=>el.addEventListener('click',()=>focusWorkforce(el.dataset.agencyCode)));
  root.querySelectorAll('[data-seasonal-note]').forEach(el=>{const go=e=>{e.stopPropagation();e.preventDefault();const note=document.getElementById('seasonal-note');if(note){note.closest('details').open=true;note.scrollIntoView({behavior:'smooth',block:'center'})}};el.addEventListener('click',go);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')go(e)})});
  document.querySelectorAll('#repair-hero [data-topic-code],#funding-context [data-topic-code]').forEach(el=>el.addEventListener('click',()=>focusFunding(el.dataset.topicCode,el.dataset.metric)));
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
