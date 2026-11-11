/* Source-bound context charts; percentages use the complete selected obligation total. */
window.FundingContextCharts=(()=>{
 let observers=[];
 const svgNS='http://www.w3.org/2000/svg';
 const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(n);
 const pct=n=>n>0&&n<.001?'<0.1%':(n*100).toFixed(1)+'%';
 const node=(name,attrs={},text)=>{const el=document.createElementNS(svgNS,name);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text!=null)el.textContent=text;return el};
 const topics={'Defense':'050','Transportation':'400','Health':'550','Education, training & social services':'500','Law enforcement & justice':'750','Veterans benefits & services':'700','Income security':'600','Natural resources & environment':'300','Energy':'270','International affairs':'150','General government':'800','Community development & disaster relief':'450','Agriculture':'350','Commerce & housing credit':'370','Science, space & technology':'250','Medicare':'570','Social Security':'650'};
 function interest(data,host){
  if(!host)return;
  const years=new Set([2004,2008,2012,2016,2020,2024,2026]),points=data.net_interest_trend.filter(d=>years.has(d.year)).sort((a,b)=>a.year-b.year);
  const render=()=>{
   const W=Math.max(280,host.clientWidth),H=260,L=60,R=18,T=34,B=38,max=Math.max(...points.map(d=>d.amount))*1.16,x=year=>L+(year-2004)/22*(W-L-R),y=value=>H-B-value/max*(H-T-B);
   host.replaceChildren();const svg=node('svg',{viewBox:'0 0 '+W+' '+H,class:'interest-history-svg',role:'group','aria-label':'Net interest budget authority, 2004 to 2026; FY2026 is an estimate'});host.append(svg);
   for(const value of [0,500e9,1000e9]){svg.append(node('line',{x1:L,x2:W-R,y1:y(value),y2:y(value),stroke:'#d8e3ef','stroke-width':1}));svg.append(node('text',{x:L-10,y:y(value)+4,'text-anchor':'end',class:'interest-axis'},value===0?'$0':money(value)));}
   const past=points.filter(d=>d.year<=2024);svg.append(node('polyline',{points:past.map(d=>x(d.year)+','+y(d.amount)).join(' '),fill:'none',stroke:'#16457a','stroke-width':2}));
   const last=points.at(-1),prior=points.at(-2);svg.append(node('line',{x1:x(prior.year),y1:y(prior.amount),x2:x(last.year),y2:y(last.amount),stroke:'#16457a','stroke-width':2,'stroke-dasharray':'4 4'}));
   const inspect=document.createElement('p');inspect.className='context-chart-inspector';inspect.setAttribute('aria-live','polite');inspect.textContent='Hover or focus a point for its year and amount.';
   for(const d of points){const point=node('circle',{cx:x(d.year),cy:y(d.amount),r:d.year===2026?4:3,fill:d.year===2026?'#fff':'#16457a',stroke:'#16457a','stroke-width':1.5,tabindex:0,role:'img','aria-label':'FY'+d.year+': '+money(d.amount)+(d.year===2026?' — estimate':'' )});point.append(node('title',{},'FY'+d.year+' · '+money(d.amount)+(d.year===2026?' · estimate':'')));const show=()=>{inspect.textContent='FY'+d.year+' · '+money(d.amount)+' net interest budget authority'+(d.year===2026?' · estimate from the FY2027 release':'');};point.addEventListener('mouseenter',show);point.addEventListener('focus',show);svg.append(point);if(d.year!==2026&&(W>=520||d.year!==2024))svg.append(node('text',{x:x(d.year),y:H-12,'text-anchor':'middle',class:'interest-axis'},d.year));}
   svg.append(node('text',{x:W-R,y:Math.max(18,y(last.amount)-16),'text-anchor':'end',class:'interest-endpoint'},'2026 estimate · '+money(last.amount)));host.append(inspect);
  };const observer=new ResizeObserver(render);observer.observe(host);observers.push(observer);render();
 }
 function composition(data,host){
  if(!host||!window.d3)return;
  const ch=data.choices,total=ch.choices_obligations.b,rows=ch.by_topic.filter(d=>d.b>0).map(d=>({...d,id:topics[d.topic]})),assigned=rows.reduce((s,d)=>s+d.b,0),remainder=total-assigned;
  if(remainder < -Math.max(1,total*1e-10))throw Error('Topic amounts exceed the non-entitlement total');
  if(remainder>1)rows.push({topic:'Accounts outside listed topics',b:remainder,a:null,amount:null,id:null,remainder:true});
  host.replaceChildren();const canvas=document.createElement('div');canvas.className='composition-map';const info=document.createElement('p');info.className='context-chart-inspector';info.setAttribute('aria-live','polite');info.textContent='Select an area to open its accounts. Percentages refer to the non-entitlement, non-interest total.';
  const footer=document.createElement('p');footer.className='chart-note';footer.textContent=remainder>1?money(remainder)+' ('+pct(remainder/total)+') is outside the listed topics and is retained as a separate area. No topic allocation is estimated.':'The areas reconcile to the full reported total.';
  const key=document.createElement('details');key.className='composition-topics';const summary=document.createElement('summary');summary.textContent='All topics and amounts';key.append(summary);const chips=document.createElement('div');chips.className='composition-topic-chips';key.append(chips);
  const colors=['#002868','#1b51a6','#326e9a','#267b8c','#526f93','#245b80','#467893','#1e6485'];
  const activate=d=>{if(d.id)window.dispatchEvent(new CustomEvent('atlas-focus-funding',{detail:{topic:d.id,metric:'obligations'}}));};
  rows.forEach((d,i)=>{d.color=d.remainder?'#6b7f88':colors[i%colors.length];const button=document.createElement('button');button.type='button';button.className='composition-topic-chip';button.textContent=d.topic+' · '+money(d.b)+' · '+pct(d.b/total);button.style.setProperty('--topic-color',d.color);if(!d.id)button.disabled=true;else button.onclick=()=>activate(d);chips.append(button);});
  host.append(canvas,info,key,footer);
  const render=()=>{
   const W=Math.max(240,canvas.clientWidth),H=W<560?560:420,tree=d3.hierarchy({children:rows}).sum(d=>d.b||0).sort((a,b)=>b.value-a.value);d3.treemap().size([W,H]).paddingInner(3).round(true)(tree);canvas.replaceChildren();const svg=node('svg',{viewBox:'0 0 '+W+' '+H,role:'group','aria-label':'Distribution of FY2026 obligations outside entitlements and debt interest; total '+money(total)});
   for(const [leafIndex,leaf] of tree.leaves().entries()){const d=leaf.data,w=leaf.x1-leaf.x0,h=leaf.y1-leaf.y0;if(w<.5||h<.5)continue;const g=node('g',{transform:'translate('+leaf.x0+' '+leaf.y0+')',tabindex:0,role:d.id?'button':'img','aria-label':d.topic+'; '+money(d.b)+'; '+pct(d.b/total)+' of the non-entitlement, non-interest total'});const clipId='funding-composition-tile-'+leafIndex,defs=node('defs'),clip=node('clipPath',{id:clipId});clip.append(node('rect',{width:w,height:h}));defs.append(clip);g.append(defs);g.setAttribute('clip-path','url(#'+clipId+')');g.append(node('rect',{width:w,height:h,fill:d.color}));g.append(node('title',{},d.topic+' · '+money(d.b)+' · '+pct(d.b/total)));const show=()=>{info.textContent=d.topic+' · '+money(d.b)+' · '+pct(d.b/total)+' of the '+money(total)+' non-entitlement, non-interest total'+(d.a!=null?' · FY2024 '+money(d.a)+' · change '+(d.amount>0?'+':'')+money(d.amount):' · No single topic allocation is assigned');};g.addEventListener('mouseenter',show);g.addEventListener('focus',show);if(d.id){g.addEventListener('click',()=>activate(d));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(d);}});}
    if(w>=105&&h>=60){const maxChars=Math.max(9,Math.floor((w-20)/8)),limit=Math.min(3,Math.floor((h-30)/18)),lines=[];let line='';for(const word of d.topic.split(' ')){if((line+' '+word).trim().length>maxChars&&line){lines.push(line);line=word;}else line=(line+' '+word).trim();}if(line)lines.push(line);const clipped=lines.slice(0,limit);if(lines.length>limit)clipped[limit-1]=clipped[limit-1].replace(/\s+\S*$/,'')+'…';for(const [i,text]of clipped.map(line=>line.length>maxChars?line.slice(0,maxChars-1)+'…':line).entries())g.append(node('text',{x:10,y:22+i*18,class:'composition-label'},text));g.append(node('text',{x:10,y:Math.min(h-10,clipped.length*18+28),class:'composition-amount'},(w>=180?money(d.b)+' · ':'')+pct(d.b/total)));}
    svg.append(g);
   }canvas.append(svg);
  };const observer=new ResizeObserver(render);observer.observe(canvas);observers.push(observer);render();
 }
 return {render(data){observers.forEach(o=>o.disconnect());observers=[];interest(data,document.querySelector('.interest-chart-host'));composition(data,document.querySelector('.funding-composition-host'));}};
})();
