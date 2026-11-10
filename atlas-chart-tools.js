/* A second, accessible reading of the exact records bound to each bubble plot.
   It shares selection with the existing drilldowns and never re-aggregates data. */
window.AtlasChartTools = {
  enhance(svg, {people=false}={}) {
    const host=svg.closest('.bubble-scroll,.allocation-host')||svg.parentElement;
    if(!host)return;
    const compact=value=>value==null?'Unavailable':new Intl.NumberFormat('en-US',people?{notation:'compact',maximumFractionDigits:1}:{notation:'compact',style:'currency',currency:'USD',maximumFractionDigits:2}).format(value);
    const title=value=>people?value.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()):value;
    const groups=[...svg.querySelectorAll(people?'g.agency-bubble':'g.allocation-bubble')].filter(g=>g.style.pointerEvents!=='none');
    const rows=groups.map(g=>({g,r:people?g.__data__.record:g.__data__})).sort((a,b)=>Math.abs((b.r.b??0)-(b.r.a??0))-Math.abs((a.r.b??0)-(a.r.a??0)));
    const mode=svg.dataset.chartMode||host.dataset.chartMode||(matchMedia('(max-width:650px)').matches?'ranked':'bubbles');host.dataset.chartMode=mode;
    const oldStage=host.querySelector('.atlas-bubble-stage');if(oldStage){host.append(svg);oldStage.remove();}
    host.querySelector('.atlas-chart-toolbar')?.remove();host.querySelector('.atlas-ranked')?.remove();host.querySelector('.chart-reading')?.remove();
    const toolbar=document.createElement('div');toolbar.className='atlas-chart-toolbar';
    toolbar.innerHTML='<div class="atlas-display-switch" role="group" aria-label="Chart display"><button type="button" data-chart-mode="bubbles">Bubbles</button><button type="button" data-chart-mode="ranked">Ranked changes</button></div><label class="chart-color-control">Color<select aria-label="Chart colors"><option value="record">Agency / source unit</option><option value="direction">Direction of change</option></select></label><button type="button" class="chart-export">↓ Data CSV</button>';
    host.prepend(toolbar);
    this.hideTooltip();
    const stage=document.createElement('div');stage.className='atlas-bubble-stage';svg.before(stage);stage.append(svg);
    const ledger=document.createElement('aside');ledger.className='chart-ledger';ledger.setAttribute('aria-label','Plotted source units');stage.append(ledger);
    const ledgerTitle=document.createElement('h4');ledgerTitle.textContent=rows.length+' plotted source units';ledger.append(ledgerTitle);
    for(const [index,{g,r}] of rows.entries()){
      const button=document.createElement('button');button.type='button';button.className='ledger-row';button.hidden=index>=8;
      const code=document.createElement('span');code.className='ledger-code';code.textContent=this.shortLabel(r);
      const name=document.createElement('span');name.className='ledger-name';name.textContent=title(r.name);
      const value=document.createElement('small');value.textContent=(r.a==null||r.b==null?'Not comparable':(r.b-r.a>0?'+':'')+compact(r.b-r.a))+' change';name.append(value);
      button.append(code,name);button.onclick=()=>g.dispatchEvent(new MouseEvent('click',{bubbles:true}));ledger.append(button);
      this.attachTooltip(g,r,{people});this.attachTooltip(button,r,{people});g.querySelector('title')?.remove();
    }
    if(rows.length>8){const all=document.createElement('button');all.className='ledger-more';all.textContent='Show all '+rows.length+' plotted records';all.onclick=()=>{ledger.querySelectorAll('.ledger-row').forEach(r=>r.hidden=false);all.remove()};ledger.append(all);}
    const colorControl=toolbar.querySelector('select');const colorKey=svg.dataset.colorMode||'record';
    const direction=r=>r.a==null||r.b==null?'#8894b0':r.b<r.a?'#d8506e':r.b>r.a?'#34858c':'#8894b0';
    const setColor=value=>{
      svg.dataset.colorMode=value;colorControl.value=value;
      for(const [i,{g,r}] of rows.entries()){
        const color=value==='direction'?direction(r):this.recordColor(people?String(r.id).split('|')[0]:r.id);
        g.querySelector('circle').style.fill=color;ledger.querySelectorAll('.ledger-code')[i].style.color=color;
      }
      const legend=people?host.closest('.bubble-panel')?.querySelector('.bubble-legend'):host.previousElementSibling?.classList.contains('comparison-legend')?host.previousElementSibling:null;
      if(legend)legend.style.display=value==='record'?'none':'';
    };
    colorControl.onchange=()=>setColor(colorControl.value);setColor(colorKey);

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
    const reading=document.createElement('p');reading.className='chart-reading';reading.textContent='Same source records in both views. '+(people?'Employee counts':'Dollar amounts')+' are not normalized across drilldown levels. Circle position is layout only. All matching records remain in the source table and full export.';host.append(reading);
    this.tables(host.closest('[data-project-panel]'));
    const setMode=next=>{
      host.dataset.chartMode=next;svg.dataset.chartMode=next;svg.style.display=next==='bubbles'?'':'none';stage.hidden=next!=='bubbles';colorControl.parentElement.hidden=next!=='bubbles';list.hidden=next!=='ranked';
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
  shortLabel(row,maxChars=18){
    const id=String(row.id??'');
    const code=id.includes('|')?id.split('|').at(-1):id;
    const label=code.length<=12?code:String(row.name).split(/\s+/).slice(0,2).join(' ');
    return label.length>maxChars?label.slice(0,Math.max(1,maxChars-1))+'…':label;
  },
  recordColor(id){
    const colors=['#bd3e7b','#6254ce','#267d78','#217e96','#aa3154','#ad5626','#3866b0','#7d3fc0','#9e4866','#48773e','#875735'];
    let hash=0;for(const c of String(id))hash=(hash*31+c.charCodeAt(0))>>>0;
    return colors[hash%colors.length];
  },
  hideTooltip(){const tip=document.getElementById('atlas-tooltip');if(tip)tip.hidden=true;this.tooltipTarget?.removeAttribute('aria-describedby');this.tooltipTarget=null;},
  attachTooltip(target,row,{people=false,endPeriod}={}){
    let tip=document.getElementById('atlas-tooltip');
    if(!tip){tip=document.createElement('div');tip.id='atlas-tooltip';tip.className='atlas-tooltip';tip.setAttribute('role','tooltip');tip.hidden=true;document.body.append(tip);window.addEventListener('scroll',()=>{if(document.activeElement!==this.tooltipTarget)this.hideTooltip()},{capture:true,passive:true});window.addEventListener('keydown',e=>{if(e.key==='Escape')this.hideTooltip()});}
    if(target._atlasTipEvents)for(const [event,fn] of Object.entries(target._atlasTipEvents))target.removeEventListener(event,fn);
    const exact=value=>value==null?'Unavailable':new Intl.NumberFormat('en-US',people?{maximumFractionDigits:0}:{style:'currency',currency:'USD',maximumFractionDigits:2}).format(value);
    const move=event=>{
      const bounds=target.getBoundingClientRect(),x=event?.clientX??bounds.left+bounds.width/2,y=event?.clientY??bounds.top+bounds.height/2;
      tip.style.left=Math.max(12,Math.min(innerWidth-tip.offsetWidth-12,x+18))+'px';tip.style.top=Math.max(12,Math.min(innerHeight-tip.offsetHeight-12,y+16))+'px';
    };
    const show=event=>{
      tip.replaceChildren();this.tooltipTarget=target;
      const heading=document.createElement('strong');heading.textContent=this.shortLabel(row)+' · '+(people?row.name.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()):row.name);
      const source=document.createElement('small');source.textContent=people?'OPM · reported civilian headcount':'OMB SF 133 · reported discretionary amounts';
      const values=document.createElement('p');const end=(endPeriod||document.getElementById('end')?.value)==='202608'?'Aug 31, 2026':'Sep 30, 2026';values.textContent=(people?'Dec 31, 2024':'FY2024')+': '+exact(row.a)+' → '+(people?end:'FY2026')+': '+exact(row.b);
      const delta=document.createElement('p');delta.className='tip-delta';delta.textContent='Change: '+(row.a==null||row.b==null?'Not comparable':(row.b-row.a>0?'+':'')+exact(row.b-row.a))+(people?' employees':'');
      const action=document.createElement('span');action.className='tip-action';action.textContent='Select to explore the source records →';
      tip.append(heading,source,values,delta,action);tip.hidden=false;target.setAttribute('aria-describedby','atlas-tooltip');move(event);
    };
    const hide=()=>{if(this.tooltipTarget===target){tip.hidden=true;target.removeAttribute('aria-describedby');}};
    const events={pointerenter:show,pointermove:event=>{if(!tip.hidden&&this.tooltipTarget===target)move(event)},pointerleave:hide,focusin:()=>show(),focusout:hide,click:hide};
    target._atlasTipEvents=events;for(const [event,fn] of Object.entries(events))target.addEventListener(event,fn);
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
