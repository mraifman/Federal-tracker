/* A second, accessible reading of the exact records bound to each bubble plot.
   It shares selection with the existing drilldowns and never re-aggregates data. */
window.AtlasChartTools = {
  enhance(svg, {people=false}={}) {
    const host=svg.parentElement;
    if(!host)return;
    const compact=value=>value==null?'Unavailable':new Intl.NumberFormat('en-US',people?{notation:'compact',maximumFractionDigits:1}:{notation:'compact',style:'currency',currency:'USD',maximumFractionDigits:2}).format(value);
    const title=value=>people?value.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()):value;
    const groups=[...svg.querySelectorAll(people?'g.agency-bubble':'g.allocation-bubble')].filter(g=>g.style.pointerEvents!=='none');
    const rows=groups.map(g=>({g,r:people?g.__data__.record:g.__data__})).sort((a,b)=>Math.abs((b.r.b??0)-(b.r.a??0))-Math.abs((a.r.b??0)-(a.r.a??0)));
    const mode=svg.dataset.chartMode||host.dataset.chartMode||(matchMedia('(max-width:650px)').matches?'ranked':'bubbles');host.dataset.chartMode=mode;
    host.querySelector('.atlas-chart-toolbar')?.remove();host.querySelector('.atlas-ranked')?.remove();host.querySelector('.chart-reading')?.remove();
    const toolbar=document.createElement('div');toolbar.className='atlas-chart-toolbar';
    toolbar.innerHTML='<div class="atlas-display-switch" role="group" aria-label="Chart display"><button type="button" data-chart-mode="bubbles">Bubbles</button><button type="button" data-chart-mode="ranked">Ranked changes</button></div><button type="button" class="chart-export">↓ Data CSV</button>';
    host.prepend(toolbar);
    const list=document.createElement('div');list.className='atlas-ranked';
    const heading=document.createElement('div');heading.className='ranked-head';heading.innerHTML='<span>Largest absolute changes · select to explore</span><span>← Decrease · Increase →</span>';list.append(heading);
    const max=Math.max(1,...rows.filter(({r})=>r.a!=null&&r.b!=null).map(({r})=>Math.abs(r.b-r.a)));
    for(const [index,{g,r}] of rows.entries()){
      const delta=r.a==null||r.b==null?null:r.b-r.a;
      const button=document.createElement('button');button.className='ranked-row';button.hidden=index>=12;button.type='button';button.dataset.rankedId=r.id;
      const name=document.createElement('span');name.className='ranked-label';name.textContent=title(r.name);
      const track=document.createElement('span');track.className='ranked-track';track.setAttribute('aria-hidden','true');
      const bar=document.createElement('i');bar.style.width=(delta==null?0:Math.abs(delta)/max*50)+'%';bar.className=delta>0?'gain':'';track.append(bar);
      const value=document.createElement('span');value.className='ranked-value';value.textContent=delta==null?'Not comparable':(delta>0?'+':'')+compact(delta);
      button.setAttribute('aria-label',title(r.name)+'; '+(people?'employee':'dollar')+' change '+(delta==null?'not comparable':delta)+'; select to explore');
      button.append(name,track,value);button.onclick=()=>g.dispatchEvent(new MouseEvent('click',{bubbles:true}));
      button.onfocus=()=>g.dispatchEvent(new Event('mouseenter'));list.append(button);
    }
    if(rows.length>12){const more=document.createElement('button');more.className='outline ranked-more';more.type='button';more.textContent='Show all '+rows.length+' chart records';more.onclick=()=>{list.querySelectorAll('.ranked-row').forEach(r=>r.hidden=false);more.remove()};list.append(more);}
    if(!rows.length){const p=document.createElement('p');p.textContent='No comparable records in this selection.';list.append(p);}
    host.append(list);
    const reading=document.createElement('p');reading.className='chart-reading';reading.textContent='Same source records in both views. '+(people?'Employee counts':'Dollar amounts')+' are not normalized across drilldown levels. All matching records remain in the source table and full export.';host.append(reading);
    this.tables(host.closest('[data-project-panel]'));
    const setMode=next=>{
      host.dataset.chartMode=next;svg.dataset.chartMode=next;svg.style.display=next==='bubbles'?'':'none';list.hidden=next!=='ranked';
      toolbar.querySelectorAll('[data-chart-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.chartMode===next)));
    };
    toolbar.querySelectorAll('[data-chart-mode]').forEach(button=>button.onclick=()=>setMode(button.dataset.chartMode));setMode(mode);
    toolbar.querySelector('.chart-export').onclick=()=>{
      const quote=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
      const headers=['source_id','name','baseline','comparison','change','unit','scope'];
      const csv=[headers,...rows.map(({r})=>[r.id,r.name,r.a,r.b,r.a==null||r.b==null?null:r.b-r.a,people?'employees':'USD','Displayed chart records only; use the full view export for all records'])].map(row=>row.map(quote).join(',')).join('\r\n');
      const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=people?'workforce-chart-records.csv':'funding-chart-records.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
  },
  tables(panel){
    if(!panel)return;
    this.tableOpen??=new Map();
    panel.querySelectorAll('#agencies > .table-scroll, #funding-app > .table-scroll, .trend-main > .table-scroll').forEach(table=>{
      const footer=table.nextElementSibling?.classList.contains('table-footer')?table.nextElementSibling:null;
      const details=document.createElement('details');details.className='records-table';const key=panel.id+':'+(table.parentElement.id||'records');details.open=this.tableOpen.get(key)||false;details.ontoggle=()=>{if(details.isConnected)this.tableOpen.set(key,details.open)};
      const summary=document.createElement('summary');summary.textContent='Compare the source records';details.append(summary);table.before(details);details.append(table);if(footer)details.append(footer);
    });
  }
};
