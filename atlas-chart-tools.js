/* A second, accessible reading of the exact records bound to each bubble plot.
   It shares selection with the existing drilldowns and never re-aggregates data. */
window.AtlasChartTools = {
  filterStates:new Map(),
  arrangeFilters(root,selectors,preserve=[]){
    const controls=selectors.map(s=>root.querySelector(s)).filter(Boolean);if(!controls.length)return;
    const layout=document.createElement('div');layout.className='explore-layout';
    const filters=document.createElement('details');filters.className='award-filter-panel explore-filters';filters.open=this.filterStates.get(root.id)??!matchMedia('(max-width:760px)').matches;
    const summary=document.createElement('summary');summary.textContent='Filters';filters.append(summary);filters.addEventListener('toggle',()=>this.filterStates.set(root.id,filters.open));
    const results=document.createElement('div');results.className='explore-results';for(const control of controls)filters.append(control);
    for(const child of [...root.children])if(!preserve.some(s=>child.matches(s)))results.append(child);
    layout.append(filters,results);root.append(layout);
  },
  agencyNames: {"Administrative Conference of the U.S.":"ACUS","ADMINISTRATIVE CONFERENCE OF THE UNITED STATES":"ACUS","Advisory Council on Historic Preservation":"ACHP","ADVISORY COUNCIL ON HISTORIC PRESERVATION":"ACHP","African Development Foundation":"USADF","AFRICAN DEVELOPMENT FOUNDATION":"USADF","American Battle Monuments Commission":"ABMC","AMERICAN BATTLE MONUMENTS COMMISSION":"ABMC","Appalachian Regional Commission":"ARC","APPALACHIAN REGIONAL COMMISSION":"ARC","Armed Forces Retirement Home":"AFRH","ARMED FORCES RETIREMENT HOME":"AFRH","Barry Goldwater Scholarship and Excellence In Education Foundation":"GOLDWATER","BARRY GOLDWATER SCHOLARSHIP AND EXCELLENCE IN EDUCATION FOUNDATION":"GOLDWATER","Commission for the Preservation of America's Heritage Abroad":"HERITAGEABROAD","COMMISSION FOR THE PRESERVATION OF AMERICA'S HERITAGE ABROAD":"HERITAGEABROAD","Commission of Fine Arts":"CFA","COMMISSION OF FINE ARTS":"CFA","Commission on Civil Rights":"USCCR","COMMISSION ON CIVIL RIGHTS":"USCCR","Committee for Purchase from People Who Are Blind or Severely Disabled":"ABILITYONE","COMMITTEE FOR PURCHASE FROM PEOPLE WHO ARE BLIND OR SE VERELY DISABLED":"ABILITYONE","Commodity Futures Trading Commission":"CFTC","COMMODITY FUTURES TRADING COMMISSION":"CFTC","Consumer Product Safety Commission":"CPSC","CONSUMER PRODUCT SAFETY COMMISSION":"CPSC","Corporation for National and Community Service":"CNCS","CORPORATION FOR NATIONAL AND COMMUNITY SERVICE":"CNCS","Council of the Inspectors General on Integrity and Efficiency":"CIGIE","COUNCIL OF THE INSPECTORS GENERAL ON INTEGRITY AND EFFICIENCY":"CIGIE","Defense Nuclear Facilities Safety Board":"DNFSB","DEFENSE NUCLEAR FACILITIES SAFETY BOARD":"DNFSB","Delta Regional Authority":"DRA","DELTA REGIONAL AUTHORITY":"DRA","Denali Commission":"DENALI","DENALI COMMISSION":"DENALI","Department of Agriculture":"USDA","DEPARTMENT OF AGRICULTURE":"USDA","Department of Commerce":"DOC","DEPARTMENT OF COMMERCE":"DOC","Department of Defense":"DOD","DEPARTMENT OF DEFENSE":"DOD","Department of Education":"ED","DEPARTMENT OF EDUCATION":"ED","Department of Energy":"DOE","DEPARTMENT OF ENERGY":"DOE","Department of Health and Human Services":"HHS","DEPARTMENT OF HEALTH AND HUMAN SERVICES":"HHS","Department of Homeland Security":"DHS","DEPARTMENT OF HOMELAND SECURITY":"DHS","Department of Housing and Urban Development":"HUD","DEPARTMENT OF HOUSING AND URBAN DEVELOPMENT":"HUD","Department of Justice":"DOJ","DEPARTMENT OF JUSTICE":"DOJ","Department of Labor":"DOL","DEPARTMENT OF LABOR":"DOL","Department of State":"DOS","DEPARTMENT OF STATE":"DOS","Department of the Interior":"DOI","DEPARTMENT OF THE INTERIOR":"DOI","Department of the Treasury":"Treasury","DEPARTMENT OF THE TREASURY":"Treasury","Department of Transportation":"DOT","DEPARTMENT OF TRANSPORTATION":"DOT","Department of Veterans Affairs":"VA","DEPARTMENT OF VETERANS AFFAIRS":"VA","Election Assistance Commission":"EAC","ELECTION ASSISTANCE COMMISSION":"EAC","Environmental Protection Agency":"EPA","ENVIRONMENTAL PROTECTION AGENCY":"EPA","Equal Employment Opportunity Commission":"EEOC","EQUAL EMPLOYMENT OPPORTUNITY COMMISSION":"EEOC","Export-Import Bank of the United States":"EXIM","EXPORT-IMPORT BANK OF THE UNITED STATES":"EXIM","Farm Credit System Insurance Corporation":"FCSIC","FARM CREDIT SYSTEM INSURANCE CORPORATION":"FCSIC","Federal Communications Commission":"FCC","FEDERAL COMMUNICATIONS COMMISSION":"FCC","Federal Deposit Insurance Corporation":"FDIC","FEDERAL DEPOSIT INSURANCE CORPORATION":"FDIC","Federal Election Commission":"FEC","FEDERAL ELECTION COMMISSION":"FEC","Federal Financial Institutions Examination Council":"FFIEC","FEDERAL FINANCIAL INSTITUTIONS EXAMINATION COUNCIL":"FFIEC","Federal Labor Relations Authority":"FLRA","FEDERAL LABOR RELATIONS AUTHORITY":"FLRA","Federal Maritime Commission":"FMC","FEDERAL MARITIME COMMISSION":"FMC","Federal Mediation and Conciliation Service":"FMCS","FEDERAL MEDIATION AND CONCILIATION SERVICE":"FMCS","Federal Mine Safety and Health Review Commission":"FMSHRC","FEDERAL MINE SAFETY AND HEALTH REVIEW COMMISSION":"FMSHRC","Federal Permitting Improvement Steering Council":"FPISC","FEDERAL PERMITTING IMPROVEMENT STEERING COUNCIL":"FPISC","Federal Trade Commission":"FTC","FEDERAL TRADE COMMISSION":"FTC","General Services Administration":"GSA","GENERAL SERVICES ADMINISTRATION":"GSA","Gulf Coast Ecosystem Restoration Council":"GCERC","GULF COAST ECOSYSTEM RESTORATION COUNCIL":"GCERC","Harry S Truman Scholarship Foundation":"TRUMAN","HARRY S. TRUMAN SCHOLARSHIP FOUNDATION":"TRUMAN","Inter-American Foundation":"IAF","INTER-AMERICAN FOUNDATION":"IAF","James Madison Memorial Fellowship Foundation":"MADISON","JAMES MADISON MEMORIAL FELLOWSHIP FOUNDATION":"MADISON","Japan-United States Friendship Commission":"JUSFC","JAPAN-UNITED STATES FRIENDSHIP COMMISSION":"JUSFC","Marine Mammal Commission":"MMC","MARINE MAMMAL COMMISSION":"MMC","Merit Systems Protection Board":"MSPB","MERIT SYSTEMS PROTECTION BOARD":"MSPB","Millennium Challenge Corporation":"MCC","MILLENNIUM CHALLENGE CORPORATION":"MCC","Morris K. Udall and Stewart L. Udall Foundation":"UDALL","MORRIS K. UDALL AND STEWART L. UDALL FOUNDATION":"UDALL","National Aeronautics and Space Administration":"NASA","NATIONAL AERONAUTICS AND SPACE ADMINISTRATION":"NASA","National Archives and Records Administration":"NARA","NATIONAL ARCHIVES AND RECORDS ADMINISTRATION":"NARA","National Capital Planning Commission":"NCPC","NATIONAL CAPITAL PLANNING COMMISSION":"NCPC","National Council on Disability":"NCD","NATIONAL COUNCIL ON DISABILITY":"NCD","National Credit Union Administration":"NCUA","NATIONAL CREDIT UNION ADMINISTRATION":"NCUA","National Labor Relations Board":"NLRB","NATIONAL LABOR RELATIONS BOARD":"NLRB","National Mediation Board":"NMB","NATIONAL MEDIATION BOARD":"NMB","National Science Foundation":"NSF","NATIONAL SCIENCE FOUNDATION":"NSF","National Transportation Safety Board":"NTSB","NATIONAL TRANSPORTATION SAFETY BOARD":"NTSB","Northern Border Regional Commission":"NBRC","NORTHERN BORDER REGIONAL COMMISSION":"NBRC","Nuclear Regulatory Commission":"NRC","NUCLEAR REGULATORY COMMISSION":"NRC","Nuclear Waste Technical Review Board":"NWTRB","NUCLEAR WASTE TECHNICAL REVIEW BOARD":"NWTRB","Occupational Safety and Health Review Commission":"OSHRC","OCCUPATIONAL SAFETY AND HEALTH REVIEW COMMISSION":"OSHRC","Office of Government Ethics":"OGE","OFFICE OF GOVERNMENT ETHICS":"OGE","Office of Navajo and Hopi Indian Relocation":"ONHIR","OFFICE OF NAVAJO AND HOPI INDIAN RELOCATION":"ONHIR","Office of Personnel Management":"OPM","OFFICE OF PERSONNEL MANAGEMENT":"OPM","Office of Special Counsel":"OSC","OFFICE OF SPECIAL COUNSEL":"OSC","Peace Corps":"PC","PEACE CORPS":"PC","Pension Benefit Guaranty Corporation":"PBGC","PENSION BENEFIT GUARANTY CORPORATION":"PBGC","Presidio Trust":"PRESIDIO","PRESIDIO TRUST":"PRESIDIO","Privacy and Civil Liberties Oversight Board":"PCLOB","PRIVACY AND CIVIL LIBERTIES OVERSIGHT BOARD":"PCLOB","Public Buildings Reform Board":"PBRB","PUBLIC BUILDINGS REFORM BOARD":"PBRB","Railroad Retirement Board":"RRB","RAILROAD RETIREMENT BOARD":"RRB","Securities and Exchange Commission":"SEC","SECURITIES AND EXCHANGE COMMISSION":"SEC","Selective Service System":"SSS","SELECTIVE SERVICE SYSTEM":"SSS","Small Business Administration":"SBA","SMALL BUSINESS ADMINISTRATION":"SBA","Social Security Administration":"SSA","SOCIAL SECURITY ADMINISTRATION":"SSA","Southwest Border Regional Commission":"SBRC","SOUTHWEST BORDER REGIONAL COMMISSION":"SBRC","Surface Transportation Board":"STB","SURFACE TRANSPORTATION BOARD":"STB","U.S. Agency for Global Media":"USAGM","U.S. AGENCY FOR GLOBAL MEDIA":"USAGM","U.S. Interagency Council on Homelessness":"USICH","U.S. INTERAGENCY COUNCIL ON HOMELESSNESS":"USICH","Agency for International Development":"USAID","U.S. AGENCY FOR INTERNATIONAL DEVELOPMENT":"USAID","Court Services and Offender Supervision Agency":"CSOSA","COURT SERVICES AND OFFENDER SUPERVISION AGENCY FOR THE DISTRICT OF COLUMBIA":"CSOSA","U.S. International Development Finance Corporation":"DFC","DEVELOPMENT FINANCE CORPORATION":"DFC","United States Trade and Development Agency":"USTDA","TRADE AND DEVELOPMENT AGENCY":"USTDA","International Trade Commission":"USITC","U.S. INTERNATIONAL TRADE COMMISSION":"USITC","United States Chemical Safety Board":"CSB","CHEMICAL SAFETY AND HAZARD INVESTIGATION BOARD":"CSB","National Institutes of Health":"NIH","Centers for Disease Control and Prevention":"CDC","Food and Drug Administration":"FDA","Federal Aviation Administration":"FAA"},
  agencyLabel(row){const normalize=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');const n=normalize(row.name);return Object.entries(this.agencyNames).find(([name])=>normalize(name)===n)?.[1]||'';},
  enhance(svg, {people=false}={}) {
    const host=svg.closest('.bubble-scroll,.allocation-host')||svg.parentElement;
    if(!host)return;
    const compact=value=>value==null?'Unavailable':new Intl.NumberFormat('en-US',people?{notation:'compact',maximumFractionDigits:1}:{notation:'compact',style:'currency',currency:'USD',maximumFractionDigits:2}).format(value);
    const title=value=>this.displayName(value);
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
      const code=document.createElement('span');code.className='ledger-code';code.textContent=this.agencyLabel(r);
      const name=document.createElement('span');name.className='ledger-name';name.textContent=title(r.name);
      const value=document.createElement('small');value.textContent=(r.a==null||r.b==null?'Not comparable':(r.b-r.a>0?'+':'')+compact(r.b-r.a))+' change';name.append(value);
      button.append(code,name);button.onclick=()=>g.dispatchEvent(new MouseEvent('click',{bubbles:true}));ledger.append(button);
      this.attachTooltip(g,r,{people});this.attachTooltip(button,r,{people});g.querySelector('title')?.remove();
    }
    if(rows.length>8){const all=document.createElement('button');all.className='ledger-more';all.textContent='Show all '+rows.length+' plotted records';all.onclick=()=>{ledger.querySelectorAll('.ledger-row').forEach(r=>r.hidden=false);all.remove()};ledger.append(all);}
    const colorControl=toolbar.querySelector('select');const colorKey=svg.dataset.colorMode||(people?'record':'direction');
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
    const rankedLimit=!people&&matchMedia('(max-width:650px)').matches?5:12;
    for(const [index,{g,r}] of rows.entries()){
      const delta=r.a==null||r.b==null?null:r.b-r.a;
      const button=document.createElement('button');button.className='ranked-row';button.hidden=index>=rankedLimit;button.type='button';button.dataset.rankedId=r.id;
      const name=document.createElement('span');name.className='ranked-label';name.textContent=title(r.name);
      const track=document.createElement('span');track.className='ranked-track';track.setAttribute('aria-hidden','true');
      const bar=document.createElement('i');bar.style.width=(delta==null?0:Math.abs(delta)/max*50)+'%';bar.className=delta>0?'gain':'';track.append(bar);
      const value=document.createElement('span');value.className='ranked-value';value.textContent=delta==null?'Not comparable':(delta>0?'+':'')+compact(delta);
      button.setAttribute('aria-label',title(r.name)+'; '+(people?'employee':'dollar')+' change '+(delta==null?'not comparable':delta)+'; select to explore');
      button.append(name,track,value);button.onclick=()=>g.dispatchEvent(new MouseEvent('click',{bubbles:true}));
      button.onfocus=()=>g.dispatchEvent(new Event('mouseenter'));list.append(button);
    }
    if(rows.length>rankedLimit){const more=document.createElement('button');more.className='outline ranked-more';more.type='button';more.textContent='Show all '+rows.length+' chart records';more.onclick=()=>{list.querySelectorAll('.ranked-row').forEach(r=>r.hidden=false);more.remove()};list.append(more);}
    if(!rows.length){const p=document.createElement('p');p.textContent='No comparable records in this selection.';list.append(p);}
    host.append(list);
    const reading=document.createElement('p');reading.className='chart-reading';reading.textContent='Same source records in both views. '+(people?'Employee counts':'Dollar amounts')+' are not normalized across drilldown levels. Circle position is layout only. All matching records remain in the source table and full export.';host.append(reading);
    this.tables(host.closest('[data-project-panel]'));
    const setMode=next=>{
      host.dataset.chartMode=next;svg.dataset.chartMode=next;svg.style.display=next==='bubbles'?'':'none';stage.hidden=next!=='bubbles';colorControl.parentElement.hidden=next!=='bubbles';list.hidden=next!=='ranked';
      if(next==='bubbles'&&!people){const scene=d3.select(svg);this.bubbleLabels(scene.selectAll('.allocation-name'),d=>d);scene.selectAll('.allocation-value').attr('y',function(d){return d.callout?7:d3.select(this.parentNode).select('.allocation-name').selectAll('tspan').size()>2?42:d.radius>45?27:15;});}
      toolbar.querySelectorAll('[data-chart-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.chartMode===next)));
    };
    toolbar.querySelectorAll('[data-chart-mode]').forEach(button=>button.onclick=()=>setMode(button.dataset.chartMode));setMode(mode);
    toolbar.querySelector('.chart-export').onclick=()=>{
      const quote=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
      const headers=['source_id','name','baseline','comparison','change','unit','scope'];
      const csv=[headers,...(svg.__atlasSourceRows||rows.map(({r})=>r)).map(r=>[r.id,r.name,r.a,r.b,r.a==null||r.b==null?null:r.b-r.a,people?'employees':'USD',svg.__atlasSourceRows?'Chart source records; unclassified rows retained in export':'Displayed chart records only; use the full view export for all records'])].map(row=>row.map(quote).join(',')).join('\r\n');
      const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=people?'workforce-chart-records.csv':'funding-chart-records.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
  },
  displayName(value){
    const names=[...Object.values(this.agencyNames).filter(v=>/^[A-Z0-9]{2,5}$/.test(v)),'FMSHRC','OSHRC','USAID','NIH','CDC','HIV','AIDS','FDA','STEM','DNA','RNA','SBIR','STTR','GOCO','FFRDC','LLC','LLP','LP','PLC','SLS','IBM','SAIC','RTX','BAE','US','USA','AI','IT'];
    const acronyms=new Map(names.map(v=>[v.toLowerCase(),v]));
    return String(value||'').toLowerCase().replace(/\b[a-z][a-z0-9]*\b/g,word=>acronyms.get(word)||word[0].toUpperCase()+word.slice(1));
  },
  shortLabel(row,maxChars=Infinity){
    const alias=this.agencyLabel(row);
    const name=String(row.name||'').replace(/\bof\b/gi,'of');
    const label=alias||this.displayName(name);
    return label.length>maxChars?label.slice(0,Math.max(1,maxChars-1))+'…':label;
  },
  bubbleLabels(selection,reader){
    const api=this;
    selection.each(function(d){
      const row=reader(d),radius=d.radius,text=d3.select(this).text('');
      const uniform=this.classList.contains('allocation-name');if(uniform&&d.callout)return;if(radius<(uniform?36:28))return;
      const label=api.shortLabel(row),width=radius*1.72,maxLines=radius>55?3:radius>45?2:1;
      const uniformSize=radius>100?19:18;let size=uniform?uniformSize:radius>85?26:radius>55?22:17,lines=[];
      const probe=text.append('tspan');
      function wrap(){lines=[];let line='';for(const word of label.split(/\s+/)){const trial=line?line+' '+word:word;probe.text(trial);if(probe.node().getComputedTextLength()>width&&line){lines.push(line);line=word}else line=trial}if(line)lines.push(line);}
      for(;size>=(uniform?uniformSize:12);size--){text.style('font-size',size+'px');wrap();if(lines.length<=maxLines&&lines.every((line,i)=>{const y=lines.length>1?-12-(lines.length-1)*(size+1)/2+i*(size+1):-10,edge=Math.max(Math.abs(y-size*.8),Math.abs(y+size*.2)),chord=2*Math.sqrt(Math.max(0,radius*radius-edge*edge))*.94;probe.text(line);return probe.node().getComputedTextLength()<=Math.min(width,chord)}))break;}
      if(uniform){size=uniformSize;text.style('font-size',size+'px');}
      lines=lines.slice(0,maxLines);if(lines.join(' ')!==label){let last=lines.at(-1)||label;probe.text(last+'…');while(last.length>1&&probe.node().getComputedTextLength()>width){last=last.slice(0,-1);probe.text(last+'…')}lines[lines.length-1]=last+'…';}
      if(uniform)lines=lines.map((line,i)=>{const y=lines.length>1?-12-(lines.length-1)*(size+1)/2+i*(size+1):-10,edge=Math.max(Math.abs(y-size*.8),Math.abs(y+size*.2)),allowed=2*Math.sqrt(Math.max(0,radius*radius-edge*edge))*.94;let result=line;probe.text(result);while(result.length>1&&probe.node().getComputedTextLength()>allowed){result=result.replace(/…$/,'').slice(0,-1)+'…';probe.text(result);}return result;});
      probe.remove();text.attr('y',null);text.selectAll('tspan').data(lines).join('tspan').attr('x',0).attr('y',(line,i)=>lines.length>1?-12-(lines.length-1)*(size+1)/2+i*(size+1):-10).text(line=>line);
    });
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
      const heading=document.createElement('strong');heading.textContent=(this.agencyLabel(row)?this.agencyLabel(row)+' · ':'')+this.displayName(row.name);
      const source=document.createElement('small');source.textContent=people?'OPM · reported civilian headcount':'OMB SF 133 · reported budget authority';
      const values=document.createElement('p');const end=(endPeriod||document.getElementById('end')?.value)==='202608'?'Aug 31, 2026':'Sep 30, 2026';values.textContent=(people?'Dec 31, 2024':'FY2024')+': '+exact(row.a)+' → '+(people?end:'FY2026')+': '+exact(row.b);
      const delta=document.createElement('p');delta.className='tip-delta';delta.textContent='Change: '+(row.a==null||row.b==null?'Not comparable':(row.b-row.a>0?'+':'')+exact(row.b-row.a))+(people?' employees':'');
      const action=document.createElement('span');action.className='tip-action';action.textContent='Explore →';
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
      if(table.closest('#funding-app'))return;
      const footer=table.nextElementSibling?.classList.contains('table-footer')?table.nextElementSibling:null;
      const details=document.createElement('details');details.className='records-table';const key=panel.id+':'+(table.parentElement.id||'records');details.open=this.tableOpen.get(key)||false;details.ontoggle=()=>{if(details.isConnected)this.tableOpen.set(key,details.open)};
      const summary=document.createElement('summary');summary.textContent='Compare the source records';details.append(summary);table.before(details);details.append(table);if(footer)details.append(footer);
    });
  }
};
