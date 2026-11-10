/* The opening map uses only published OPM observations. No generated positions,
   geographic relationships, staffing targets or reconstruction costs are implied. */
(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = value => Math.round(value).toLocaleString('en-US');
  const title = value => value.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  const signed = value => (value < 0 ? '−' : value > 0 ? '+' : '') + number(Math.abs(value));
  const header = document.querySelector('.site-header');
  if (header && window.ResizeObserver) new ResizeObserver(() => document.documentElement.style.setProperty('--header-height', header.getBoundingClientRect().height + 'px')).observe(header);
  const updateHeaderSection = () => {
    const notes = document.getElementById('page-notes');
    const inNotes = notes && notes.getBoundingClientRect().top < innerHeight * .4;
    const view = document.querySelector('[data-project-tab][aria-selected="true"]')?.dataset.projectTab || 'workforce';
    document.querySelectorAll('.site-header nav a').forEach(a => {
      const active = inNotes ? a.hash === '#page-notes' : a.dataset.exploreView === view;
      if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  };
  addEventListener('scroll', updateHeaderSection, { passive: true });
  addEventListener('resize', updateHeaderSection);
  updateHeaderSection();
  const map = document.getElementById('hero-map');
  const facts = document.getElementById('atlas-facts');
  const get = async name => {
    const response = await fetch('data/' + name + '.json');
    if (!response.ok) throw new Error(name + ' unavailable');
    return response.json();
  };
  get('workforce-changes').then(data => {
    const all = data.records.departments.filter(r => r.id !== 'DOD');
    const rows = all.filter(r => r.values['202412'] > 0 && r.values['202609'] != null)
      .map(r => ({id:r.id, name:title(r.name), a:r.values['202412'], b:r.values['202609'], pct:(r.values['202609']/r.values['202412']-1)*100}));
    const before = all.reduce((sum, r) => sum + (r.values['202412'] ?? 0), 0);
    const after = all.reduce((sum, r) => sum + (r.values['202609'] ?? 0), 0);
    facts.innerHTML = '<div class="workforce-signal"><b>' + number(Math.abs(after-before)) + '</b><div><span>Net ' + (after < before ? 'fewer' : 'more') + ' reported non-defense employees</span><small>December 2024 → September 2026</small></div><a href="#method">What this measures ↗</a></div>';
    const W=520,H=350,L=82,R=20,T=24,B=55;
    const min=-100,max=Math.max(125,Math.ceil(Math.max(...rows.map(r=>r.pct))/25)*25);
    const logMax=Math.ceil(Math.log10(Math.max(...rows.map(r=>r.a))));
    const x = n => L+(n-min)/(max-min)*(W-L-R);
    const y = n => T+(1-Math.log10(n)/logMax)*(H-T-B);
    const highlights = {TR:'Treasury',AM:'USAID',VA:'Veterans Affairs'};
    let svg='<svg class="hero-map-svg" viewBox="0 0 '+W+' '+H+'" role="group" aria-label="OPM agency workforce chart: percentage change versus baseline employee count"><desc>Each point is one agency with both observations. Horizontal position is percentage headcount change from December 2024 to September 2026. Vertical position is baseline headcount on a logarithmic scale. Defense is excluded. Use left and right arrow keys to explore agencies.</desc><defs><filter id="atlas-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="6"/></filter></defs>';
    for (const n of [-100,-50,0,50,100]) svg+='<line x1="'+x(n)+'" x2="'+x(n)+'" y1="'+T+'" y2="'+(H-B)+'" stroke="'+(n===0?'#b9c6ef66':'#b9c6ef15')+'" '+(n===0?'':'stroke-dasharray="2 5"')+'/><text x="'+x(n)+'" y="'+(H-B+23)+'" text-anchor="middle">'+(n>0?'+':'')+n+'%</text>';
    for (const n of [1,100,10000,1000000].filter(n=>Math.log10(n)<=logMax)) svg+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y(n)+'" y2="'+y(n)+'" stroke="#b9c6ef15" stroke-dasharray="2 5"/><text x="'+(L-10)+'" y="'+(y(n)+3)+'" text-anchor="end">'+(n>=1e6?'1M':n>=1e3?n/1e3+'k':n)+'</text>';
    svg+='<text class="hero-y-title" transform="translate(16 '+((T+H-B)/2)+') rotate(-90)" text-anchor="middle"><tspan x="0" dy="0">Employees in</tspan><tspan x="0" dy="1.25em">December 2024</tspan></text>';
    svg+='<text x="'+(W-R)+'" y="'+(H-8)+'" text-anchor="end">Staff change (%)</text>';
    for (const [i,r] of rows.entries()) {
      const color=r.b<r.a?'#f47797':r.b>r.a?'#75d6d7':'#acb4d6';
      svg+='<g class="hero-point" role="button" tabindex="'+(i===0?'0':'-1')+'" data-hero-agency="'+esc(r.id)+'" aria-label="'+esc(r.name)+': '+number(r.a)+' to '+number(r.b)+' employees; '+signed(r.b-r.a)+'; '+r.pct.toFixed(1)+' percent"><circle cx="'+x(r.pct)+'" cy="'+y(r.a)+'" r="9" fill="'+color+'" opacity=".3" filter="url(#atlas-glow)"/><circle class="point-core" cx="'+x(r.pct)+'" cy="'+y(r.a)+'" r="3.3" fill="'+color+'"/>';
      if(highlights[r.id]) svg+='<text x="'+(x(r.pct)+(r.pct<-50?8:-8))+'" y="'+(y(r.a)-8)+'" text-anchor="'+(r.pct<-50?'start':'end')+'">'+highlights[r.id]+'</text>';
      svg+='</g>';
    }
    map.innerHTML=svg+'</svg>';
    const heroSvg=map.querySelector('svg');new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(width)heroSvg.style.setProperty('--hero-axis-size',Math.max(12,14*W/width)+'px')}).observe(map);
    const points=[...map.querySelectorAll('[data-hero-agency]')];
    points.forEach((point,i)=>{
      const r=rows[i];
      const preview=()=>{document.getElementById('hero-map-preview').textContent=r.name+' · '+number(r.a)+' → '+number(r.b)+' employees · '+r.pct.toFixed(1)+'%';};
      point.onmouseenter=preview;point.onfocus=preview;window.AtlasChartTools?.attachTooltip(point,r,{people:true,endPeriod:'202609'});
      point.onclick=()=>{
        if(!document.querySelector('#workforce-app .agency-bubble')){
          location.href='?view=workforce&department='+encodeURIComponent(r.id)+'#workforce-panel';return;
        }
        window.dispatchEvent(new CustomEvent('atlas-focus-workforce',{detail:{department:r.id}}));
        document.querySelector('[data-project-tab="workforce"]').click();
        document.getElementById('workforce-panel').scrollIntoView({behavior:'smooth'});
      };
      point.onkeydown=event=>{
        if(event.key==='Enter'||event.key===' '){event.preventDefault();point.onclick();return;}
        let next;
        if(event.key==='ArrowRight'||event.key==='ArrowDown')next=(i+1)%points.length;
        if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=(i+points.length-1)%points.length;
        if(event.key==='Home')next=0;if(event.key==='End')next=points.length-1;
        if(next!=null){event.preventDefault();points.forEach(p=>p.setAttribute('tabindex','-1'));points[next].setAttribute('tabindex','0');points[next].focus();}
      };
    });

  }).catch(()=>{
    map.innerHTML='<p class="hero-loading">Workforce chart unavailable. Explore the source views below.</p>';
    facts.innerHTML='<span class="atlas-fact">Source records and coverage are available in each view below.</span>';
  });
})();
