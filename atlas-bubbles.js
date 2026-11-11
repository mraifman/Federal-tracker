/* Source-bound, animated bubbles shared by funding and recipient views. */
window.AtlasBubbles={render(host,rows,options={}){const el=typeof host==='string'?document.querySelector(host):host;if(!el)return;rows=rows.slice(0,32);const svg=d3.select(el).selectAll('svg').data([null]).join('svg').attr('viewBox','0 0 980 550').attr('class','allocation-bubbles').attr('role','group').attr('aria-label',options.label||'Interactive funding breakdown'),width=980,height=550,fmt=options.format||String,max=Math.max(1,...rows.map(r=>Math.abs(options.size==='latest'?(r.b??0):r.a!=null&&r.b!=null?r.b-r.a:0))),circles=rows.filter(r=>r.id!=='unclassified').map(r=>({r:Math.max(10,Math.sqrt(Math.abs(options.size==='latest'?(r.b??0):r.a!=null&&r.b!=null?r.b-r.a:0)/max)*110),data:r})).sort((a,b)=>b.r-a.r);d3.packSiblings(circles);const bounds=circles.length?d3.packEnclose(circles):{x:0,y:0,r:1},scale=215/Math.max(1,bounds.r),nodes=circles.map(c=>({...c.data,x:490+(c.x-bounds.x)*scale*1.85,y:275+(c.y-bounds.y)*scale,radius:c.r*scale})),duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:650;svg.selectAll('*').interrupt();let _layer=svg.select('g.atlas-zoom');if(_layer.empty())_layer=svg.append('g').attr('class','atlas-zoom');const join=_layer.selectAll('g.allocation-bubble').data(nodes,d=>String(d.id));join.exit().attr('tabindex',-1).style('pointer-events','none').transition().duration(duration*.6).attr('transform','translate(490,275) scale(0.02)').style('opacity',0).remove();const enter=join.enter().append('g').attr('class','allocation-bubble').attr('transform','translate(490,275) scale(0.02)').style('opacity',0);enter.append('circle');enter.append('text').attr('class','allocation-name').attr('text-anchor','middle');enter.append('text').attr('class','allocation-value').attr('text-anchor','middle');enter.append('title');const all=enter.merge(join).attr('role','button').attr('tabindex',0).style('pointer-events','auto').attr('data-allocation-id',d=>d.id).attr('aria-label',d=>d.name+'; FY2024 '+fmt(d.a)+'; FY2026 '+fmt(d.b)).on('click',(e,d)=>options.onSelect?.(d)).on('keydown',(e,d)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();options.onSelect?.(d)}}).on('mouseenter focus',(e,d)=>options.onPreview?.(d));all.select('circle').attr('fill',d=>d.a==null||d.b==null?'#8894b0':d.b<d.a?'#d8506e':d.b>d.a?'#34858c':'#8894b0').transition().duration(duration).attr('r',d=>d.radius);all.select('title').text(d=>d.name+'\nFY2024 '+fmt(d.a)+' → FY2026 '+fmt(d.b));all.select('.allocation-name').text('');window.AtlasBubbles.callouts(svg.node(),nodes,{width:options.compact?780:980,height:options.compact?580:650,padding:options.compact?24:100,name:d=>d.name,onSelect:options.onSelect,onPreview:options.onPreview});all.select('circle').interrupt().attr('r',d=>d.radius);window.AtlasChartTools.bubbleLabels(all.select('.allocation-name'),d=>d);all.select('.allocation-value').attr('y',function(d){return d3.select(this.parentNode).select('.allocation-name').selectAll('tspan').size()>2?42:d.radius>45?27:15;}).style('font-size',d=>(d.radius>100?19:18)+'px').text(d=>d.radius>=36?(options.size!=='latest'&&d.a!=null&&d.b!=null&&d.b>d.a?'+':'')+fmt(options.size==='latest'?d.b:d.a!=null&&d.b!=null?d.b-d.a:null):'');all.transition().duration(duration).ease(d3.easeCubicInOut).attr('transform',d=>'translate('+d.x+','+d.y+')').style('opacity',1);window.AtlasBubbles.externalLabels(svg,nodes,options);window.AtlasBubbles._zoom(svg,_layer);svg.node().__atlasSourceRows=rows;window.AtlasChartTools?.enhance(svg.node());return nodes}};

/* Source identifiers sit inside the circles. Full names and exact figures live
   in the shared tooltip and the adjacent source-unit ledger. Positions only fit
   the diagram; they imply neither geographic nor semantic relationships. */
window.AtlasBubbles.callouts=function(svg,nodes,{width=1100,height=650,padding=100,stretch=1}={}){
 const selection=d3.select(svg);
 selection.selectAll('g.bubble-callouts,g.bubble-leaders').remove();
 const packed=nodes.map(node=>({r:node.radius+5,node}));
 if(packed.length){
  d3.packSiblings(packed);const bounds=d3.packEnclose(packed);
  const scale=Math.min((width-padding)/(bounds.r*2),(height-padding)/(bounds.r*2));
  packed.forEach(p=>{p.node.x=width/2+(p.x-bounds.x)*scale*stretch;p.node.y=height/2+(p.y-bounds.y)*scale;p.node.radius=(p.r-5)*scale});
 }
 // The overview has clear space beside International Affairs for this tiny dot.
 const environment=nodes.find(n=>n.id==='300'&&n.radius<36);
 if(environment&&nodes.some(n=>n.id==='050')&&nodes.some(n=>n.id==='150')){
  for(const offset of [0,-18,18,-36,36]){const x=width*.9,y=height*.5+offset;if(nodes.every(n=>n===environment||Math.hypot(n.x-x,n.y-y)>n.radius+environment.radius+8)){environment.x=x;environment.y=y;break;}}
 }
 selection.attr('viewBox',`0 0 ${width} ${height}`);
 return nodes;
};

/* Pinch / wheel zoom + drag pan for the allocation bubbles. The whole scene
   (bubbles, labels, leaders) lives in a g.atlas-zoom layer; this transforms that
   layer. Clicks and keyboard selection on bubbles are unaffected. Set up once
   per svg; each render resets the view to fit. */
window.AtlasBubbles._zoom=function(svg,layer){
 const node=svg.node();if(!node||typeof d3.zoom!=='function')return;
 if(!node.__atlasZoom){
  const z=d3.zoom().filter(event=>event.type!=='wheel'||event.ctrlKey||event.metaKey).scaleExtent([1,9]).on('zoom',ev=>layer.attr('transform',ev.transform));
  svg.call(z).on('dblclick.zoom',null)
     .on('dblclick',()=>svg.transition().duration(300).call(z.transform,d3.zoomIdentity));
  node.__atlasZoom=z;
 }
 svg.classed('atlas-zoomable',true);                 // re-apply: render() rewrites class each time
 svg.call(node.__atlasZoom.transform,d3.zoomIdentity);
};

/* Place short labels in vacant chart space, keeping leaders clear of other dots.
   Labels share the bubbles' source records, keyboard selection, and zoom layer. */
window.AtlasBubbles.externalLabels=function(svg,nodes,options){
 const layer=svg.select('g.atlas-zoom');layer.selectAll('.bubble-callouts,.bubble-leaders').remove();
 const [, ,width,height]=svg.attr('viewBox').split(/\s+/).map(Number);
 const aliases={'community development & disaster relief':'Community Dev. & Disaster Relief','commerce & housing credit':'Commerce & Housing Credit','social security':'Social Security','general government':'General Govt.','administration of justice':'Law Enforcement & Justice','law enforcement & justice':'Law Enforcement & Justice','veterans benefits and services':'Veterans Benefits','veterans benefits & services':'Veterans Benefits','general science, space, and technology':'Science & Space','science, space & technology':'Science & Space','education, training & social services':'Education & Social Services'};
 const labels=layer.append('g').attr('class','bubble-callouts'),leaders=layer.insert('g','.bubble-callouts').attr('class','bubble-leaders');
 const placed=[],segments=[],probe=labels.append('text').attr('class','bubble-callout-label');
 const measure=s=>{probe.text(s);return probe.node().getComputedTextLength()||s.length*8.5;};
 const intersects=(box,n,gap=6)=>Math.hypot(n.x-Math.max(box.x,Math.min(n.x,box.x+box.w)),n.y-Math.max(box.y,Math.min(n.y,box.y+box.h)))<n.radius+gap;
 const overlap=(a,b,gap=7)=>a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;
 const distance=(n,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((n.x-a.x)*dx+(n.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(n.x-a.x-t*dx,n.y-a.y-t*dy);};
 const cross=(a,b,c,d)=>{const side=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);return side(a,b,c)*side(a,b,d)<0&&side(c,d,a)*side(c,d,b)<0;};
 const hitsBox=(a,b,r)=>{const box={x:r.x-3,y:r.y-3,w:r.w+6,h:r.h+6},inside=p=>p.x>=box.x&&p.x<=box.x+box.w&&p.y>=box.y&&p.y<=box.y+box.h;const corners=[{x:box.x,y:box.y},{x:box.x+box.w,y:box.y},{x:box.x+box.w,y:box.y+box.h},{x:box.x,y:box.y+box.h}];return inside(a)||inside(b)||corners.some((p,i)=>cross(a,b,p,corners[(i+1)%4]));};
 const targets=nodes.filter(n=>{const bubble=layer.selectAll('g.allocation-bubble').filter(d=>d===n);return n.radius<36||(n.radius<90&&window.AtlasChartTools.shortLabel(n).length>20)||bubble.select('.allocation-name').text().includes('…');}).sort((a,b)=>b.radius-a.radius);
 for(const n of targets){
  const title=window.AtlasChartTools.displayName(n.name),short=aliases[title.toLowerCase()]||window.AtlasChartTools.shortLabel(n);
  const lines=[];let line='';for(const word of short.split(/\s+/)){const next=line?line+' '+word:word;if(line&&measure(next)>(n.id==='300'?105:145)){lines.push(line);line=word}else line=next;}if(line)lines.push(line);
  const w=Math.max(...lines.map(measure)),h=lines.length*18;
  let best=null;
  for(let y=12;y+h<height-12;y+=10)for(let x=12;x+w<width-12;x+=12){
   const box={x,y,w,h};if(nodes.some(d=>intersects(box,d))||placed.some(b=>overlap(box,b))||segments.some(s=>hitsBox(s[0],s[1],box)))continue;
   const end={x:Math.max(x,Math.min(n.x,x+w)),y:Math.max(y,Math.min(n.y,y+h))};
   let bend=null;
   if(nodes.some(d=>d!==n&&distance(d,n,end)<d.radius+3)){
    for(let angle=0;angle<Math.PI*2;angle+=Math.PI/12){const point={x:n.x+Math.cos(angle)*(n.radius+10),y:n.y+Math.sin(angle)*(n.radius+10)};if(!nodes.some(d=>d!==n&&distance(d,n,point)<d.radius+3)&&!nodes.some(d=>distance(d,point,end)<d.radius+3)){if(!bend||Math.hypot(point.x-end.x,point.y-end.y)<Math.hypot(bend.x-end.x,bend.y-end.y))bend=point;}}
    if(!bend)continue;
   }
   if(placed.some(b=>bend?(hitsBox(n,bend,b)||hitsBox(bend,end,b)):hitsBox(n,end,b)))continue;
   const length=bend?Math.hypot(bend.x-n.x,bend.y-n.y)+Math.hypot(end.x-bend.x,end.y-bend.y):Math.hypot(end.x-n.x,end.y-n.y),score=length+Math.abs(end.y-n.y)*.15+segments.filter(s=>cross(n,end,s[0],s[1])).length*120;
   if(!best||score<best.score)best={...box,end,bend,score};
  }
  if(!best)continue;
  n.callout=true;const bubble=layer.selectAll('g.allocation-bubble').filter(d=>d===n);bubble.select('.allocation-name').text('');bubble.select('.allocation-value').attr('y',7);
  const via=best.bend||best.end,length=Math.hypot(via.x-n.x,via.y-n.y),start={x:n.x+(via.x-n.x)*(n.radius+3)/length,y:n.y+(via.y-n.y)*(n.radius+3)/length};
  leaders.append('path').attr('d',`M${start.x},${start.y}${best.bend?'L'+best.bend.x+','+best.bend.y:''}L${best.end.x},${best.end.y}`);
  const item=labels.append('g').datum(n).attr('role','button').attr('tabindex',0).attr('aria-label',title+'; select to explore').on('click',()=>options.onSelect?.(n)).on('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();options.onSelect?.(n)}});
  item.append('rect').attr('x',best.x-3).attr('y',best.y-3).attr('width',best.w+6).attr('height',best.h+6).attr('fill','transparent');
  const text=item.append('text').attr('class','bubble-callout-label');lines.forEach((line,i)=>text.append('tspan').attr('x',best.x).attr('y',best.y+14+i*18).text(line));
  window.AtlasChartTools.attachTooltip(item.node(),n);placed.push(best);if(best.bend)segments.push([start,best.bend],[best.bend,best.end]);else segments.push([start,best.end]);
 }
 probe.remove();
};
