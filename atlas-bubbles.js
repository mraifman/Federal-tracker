/* Source-bound, animated bubbles shared by funding and recipient views. */
window.AtlasBubbles={render(host,rows,options={}){const el=typeof host==='string'?document.querySelector(host):host;if(!el)return;rows=rows.slice(0,32);const svg=d3.select(el).selectAll('svg').data([null]).join('svg').attr('viewBox','0 0 980 550').attr('class','allocation-bubbles').attr('role','group').attr('aria-label',options.label||'Interactive funding breakdown'),width=980,height=550,fmt=options.format||String,max=Math.max(1,...rows.map(r=>Math.abs(options.size==='latest'?(r.b??0):r.a!=null&&r.b!=null?r.b-r.a:0))),circles=rows.map(r=>({r:Math.max(10,Math.sqrt(Math.abs(options.size==='latest'?(r.b??0):r.a!=null&&r.b!=null?r.b-r.a:0)/max)*110),data:r})).sort((a,b)=>b.r-a.r);d3.packSiblings(circles);const bounds=circles.length?d3.packEnclose(circles):{x:0,y:0,r:1},scale=215/Math.max(1,bounds.r),nodes=circles.map(c=>({...c.data,x:490+(c.x-bounds.x)*scale*1.85,y:275+(c.y-bounds.y)*scale,radius:c.r*scale})),duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:650;svg.selectAll('*').interrupt();let _layer=svg.select('g.atlas-zoom');if(_layer.empty())_layer=svg.append('g').attr('class','atlas-zoom');const join=_layer.selectAll('g.allocation-bubble').data(nodes,d=>String(d.id));join.exit().attr('tabindex',-1).style('pointer-events','none').transition().duration(duration*.6).attr('transform','translate(490,275) scale(0.02)').style('opacity',0).remove();const enter=join.enter().append('g').attr('class','allocation-bubble').attr('transform','translate(490,275) scale(0.02)').style('opacity',0);enter.append('circle');enter.append('text').attr('class','allocation-name').attr('text-anchor','middle');enter.append('text').attr('class','allocation-value').attr('text-anchor','middle');enter.append('title');const all=enter.merge(join).attr('role','button').attr('tabindex',0).style('pointer-events','auto').attr('data-allocation-id',d=>d.id).attr('aria-label',d=>d.name+'; FY2024 '+fmt(d.a)+'; FY2026 '+fmt(d.b)).on('click',(e,d)=>options.onSelect?.(d)).on('keydown',(e,d)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();options.onSelect?.(d)}}).on('mouseenter focus',(e,d)=>options.onPreview?.(d));all.select('circle').attr('fill',d=>d.a==null||d.b==null?'#879496':d.b<d.a?'#b65e4d':d.b>d.a?'#277c80':'#879496').transition().duration(duration).attr('r',d=>d.radius);all.select('title').text(d=>d.name+'\nFY2024 '+fmt(d.a)+' → FY2026 '+fmt(d.b));all.select('.allocation-name').text('');window.AtlasBubbles.callouts(svg.node(),nodes,{width:980,name:d=>d.name,onSelect:options.onSelect,onPreview:options.onPreview});all.select('circle').interrupt().attr('r',d=>d.radius);all.select('.allocation-value').attr('y',5).style('font-size',d=>d.radius>75?'23px':d.radius>45?'16px':'11px').text(d=>d.radius>23?fmt(options.size==='latest'?d.b:d.a!=null&&d.b!=null?d.b-d.a:null):'');all.transition().duration(duration).ease(d3.easeCubicInOut).attr('transform',d=>'translate('+d.x+','+d.y+')').style('opacity',1);window.AtlasBubbles._zoom(svg,_layer);return nodes}};

/* External callouts use measured multi-line labels in two non-overlapping rails.
   The SVG grows to fit every title rather than hiding labels or colliding. */
window.AtlasBubbles.callouts=function(svg,nodes,{width=1100,name=d=>d.name,onSelect=()=>{},onPreview=()=>{}}={}){
 const svgSel=d3.select(svg),scene=svgSel.select('g.atlas-zoom').size()?svgSel.select('g.atlas-zoom'):svgSel,left=[],right=[],mid=width/2,rail=250,gap=22;
 nodes.forEach(n=>(n.x<mid?left:right).push(n));
 for(const side of [left,right])side.sort((a,b)=>a.y-b.y);
 const layer=scene.selectAll('g.bubble-callouts').data([null]).join('g').attr('class','bubble-callouts');
 const labels=layer.selectAll('g.bubble-callout').data(nodes,d=>d.id).join('g').attr('class','bubble-callout').attr('role','button').attr('tabindex',0).attr('aria-label',name).on('click',(e,d)=>onSelect(d)).on('keydown',(e,d)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(d)}}).on('mouseenter focus',(e,d)=>onPreview(d));
 labels.selectAll('path').remove();const leaders=scene.selectAll('g.bubble-leaders').data([null]).join('g').attr('class','bubble-leaders');leaders.selectAll('path').data(nodes,d=>d.id).join('path').attr('fill','none').attr('stroke','#91a0a4').attr('stroke-width',1).style('pointer-events','none');
 labels.selectAll('text').data(d=>[d]).join('text').attr('fill','#193447').style('font-size','12px').each(function(d){
  const text=d3.select(this).text(''),probe=text.append('tspan');let lines=[],line='';
  for(const word of name(d).split(/\s+/)){const trial=line?line+' '+word:word;probe.text(trial);if((probe.node().getComputedTextLength()||trial.length*7)>rail-25&&line){lines.push(line);line=word}else line=trial}if(line)lines.push(line);probe.remove();d.labelLines=lines;d.labelHeight=Math.max(30,lines.length*15+gap);
  text.selectAll('tspan').data(lines).join('tspan').attr('x',0).attr('dy',(v,i)=>i?15:0).text(v=>v);
 });
 const height=Math.max(580,...[left,right].map(side=>80+side.reduce((s,d)=>s+d.labelHeight,0)));
 // Keep circle area proportional, contained in a central panel away from titles.
 const minX=Math.min(...nodes.map(n=>n.x-n.radius)),maxX=Math.max(...nodes.map(n=>n.x+n.radius)),minY=Math.min(...nodes.map(n=>n.y-n.radius)),maxY=Math.max(...nodes.map(n=>n.y+n.radius));
 const scale=Math.min(1,(width-2*rail-42)/Math.max(1,maxX-minX),500/Math.max(1,maxY-minY));
 nodes.forEach(n=>{n.x=mid+(n.x-(minX+maxX)/2)*scale;n.y=height/2+(n.y-(minY+maxY)/2)*scale;n.radius*=scale});
 for(const side of [left,right]){let y=(height-side.reduce((s,d)=>s+d.labelHeight,0))/2;for(const d of side){d.labelY=y+d.labelHeight/2;d.labelSide=side===left?'left':'right';y+=d.labelHeight}}
 svgSel.attr('viewBox',`0 0 ${width} ${height}`);
 labels.select('text').attr('transform',d=>`translate(${d.labelSide==='left'?18:width-rail+15},${d.labelY-(d.labelLines.length-1)*7.5})`);
 leaders.selectAll('path').attr('d',d=>{const left=d.labelSide==='left',x=left?rail-10:width-rail+5,dx=x-d.x,dy=d.labelY-d.y,len=Math.hypot(dx,dy)||1;return `M${d.x+dx/len*d.radius},${d.y+dy/len*d.radius} L${left?rail+8:width-rail-8},${d.labelY} L${x},${d.labelY}`});
 leaders.lower();layer.raise();return nodes;
};

/* Pinch / wheel zoom + drag pan for the allocation bubbles. The whole scene
   (bubbles, labels, leaders) lives in a g.atlas-zoom layer; this transforms that
   layer. Clicks and keyboard selection on bubbles are unaffected. Set up once
   per svg; each render resets the view to fit. */
window.AtlasBubbles._zoom=function(svg,layer){
 const node=svg.node();if(!node||typeof d3.zoom!=='function')return;
 if(!node.__atlasZoom){
  const z=d3.zoom().scaleExtent([1,9]).on('zoom',ev=>layer.attr('transform',ev.transform));
  svg.call(z).on('dblclick.zoom',null)
     .on('dblclick',()=>svg.transition().duration(300).call(z.transform,d3.zoomIdentity));
  node.__atlasZoom=z;
 }
 svg.classed('atlas-zoomable',true);                 // re-apply: render() rewrites class each time
 svg.call(node.__atlasZoom.transform,d3.zoomIdentity);
};
