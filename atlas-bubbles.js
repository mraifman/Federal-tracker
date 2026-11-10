/* Source-bound, animated bubbles shared by funding and recipient views. */
window.AtlasBubbles={render(host,rows,options={}){const el=typeof host==='string'?document.querySelector(host):host;if(!el)return;rows=rows.slice(0,32);const svg=d3.select(el).selectAll('svg').data([null]).join('svg').attr('viewBox','0 0 980 550').attr('class','allocation-bubbles').attr('role','group').attr('aria-label',options.label||'Interactive funding breakdown'),width=980,height=550,fmt=options.format||String,max=Math.max(1,...rows.map(r=>Math.abs(options.size==='latest'?(r.b??0):r.a!=null&&r.b!=null?r.b-r.a:0))),circles=rows.map(r=>({r:Math.max(10,Math.sqrt(Math.abs(options.size==='latest'?(r.b??0):r.a!=null&&r.b!=null?r.b-r.a:0)/max)*110),data:r})).sort((a,b)=>b.r-a.r);d3.packSiblings(circles);const bounds=circles.length?d3.packEnclose(circles):{x:0,y:0,r:1},scale=215/Math.max(1,bounds.r),nodes=circles.map(c=>({...c.data,x:490+(c.x-bounds.x)*scale*1.85,y:275+(c.y-bounds.y)*scale,radius:c.r*scale})),duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:650;svg.selectAll('*').interrupt();let _layer=svg.select('g.atlas-zoom');if(_layer.empty())_layer=svg.append('g').attr('class','atlas-zoom');const join=_layer.selectAll('g.allocation-bubble').data(nodes,d=>String(d.id));join.exit().attr('tabindex',-1).style('pointer-events','none').transition().duration(duration*.6).attr('transform','translate(490,275) scale(0.02)').style('opacity',0).remove();const enter=join.enter().append('g').attr('class','allocation-bubble').attr('transform','translate(490,275) scale(0.02)').style('opacity',0);enter.append('circle');enter.append('text').attr('class','allocation-name').attr('text-anchor','middle');enter.append('text').attr('class','allocation-value').attr('text-anchor','middle');enter.append('title');const all=enter.merge(join).attr('role','button').attr('tabindex',0).style('pointer-events','auto').attr('data-allocation-id',d=>d.id).attr('aria-label',d=>d.name+'; FY2024 '+fmt(d.a)+'; FY2026 '+fmt(d.b)).on('click',(e,d)=>options.onSelect?.(d)).on('keydown',(e,d)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();options.onSelect?.(d)}}).on('mouseenter focus',(e,d)=>options.onPreview?.(d));all.select('circle').attr('fill',d=>d.a==null||d.b==null?'#8894b0':d.b<d.a?'#d8506e':d.b>d.a?'#34858c':'#8894b0').transition().duration(duration).attr('r',d=>d.radius);all.select('title').text(d=>d.name+'\nFY2024 '+fmt(d.a)+' → FY2026 '+fmt(d.b));all.select('.allocation-name').text('');window.AtlasBubbles.callouts(svg.node(),nodes,{width:options.compact?780:980,height:options.compact?580:650,padding:options.compact?24:100,name:d=>d.name,onSelect:options.onSelect,onPreview:options.onPreview});all.select('circle').interrupt().attr('r',d=>d.radius);window.AtlasChartTools.bubbleLabels(all.select('.allocation-name'),d=>d);all.select('.allocation-value').attr('y',function(d){return d3.select(this.parentNode).select('.allocation-name').selectAll('tspan').size()>2?42:d.radius>45?27:15;}).style('font-size',d=>d.radius>75?'23px':d.radius>45?'16px':'11px').text(d=>d.radius>32?(options.size!=='latest'&&d.a!=null&&d.b!=null&&d.b>d.a?'+':'')+fmt(options.size==='latest'?d.b:d.a!=null&&d.b!=null?d.b-d.a:null):'');all.transition().duration(duration).ease(d3.easeCubicInOut).attr('transform',d=>'translate('+d.x+','+d.y+')').style('opacity',1);window.AtlasBubbles._zoom(svg,_layer);window.AtlasChartTools?.enhance(svg.node());return nodes}};

/* Source identifiers sit inside the circles. Full names and exact figures live
   in the shared tooltip and the adjacent source-unit ledger. Positions only fit
   the diagram; they imply neither geographic nor semantic relationships. */
window.AtlasBubbles.callouts=function(svg,nodes,{width=1100,height=650,padding=100}={}){
 const selection=d3.select(svg);
 selection.selectAll('g.bubble-callouts,g.bubble-leaders').remove();
 const packed=nodes.map(node=>({r:node.radius+5,node}));
 if(packed.length){
  d3.packSiblings(packed);const bounds=d3.packEnclose(packed);
  const scale=Math.min((width-padding)/(bounds.r*2),(height-padding)/(bounds.r*2));
  packed.forEach(p=>{p.node.x=width/2+(p.x-bounds.x)*scale;p.node.y=height/2+(p.y-bounds.y)*scale;p.node.radius=(p.r-5)*scale});
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
