/* Keep source and scope detail in one quiet footer, replacing stale view notes. */
(()=>{'use strict';
 function collect(id,title,container,selector){
  const footer=document.getElementById('page-notes');if(!footer)return;
  const nodes=[...container.querySelectorAll(selector)];
  document.getElementById(id)?.remove();if(!nodes.length)return;
  const details=document.createElement('details');details.id=id;details.className='note-block';
  const summary=document.createElement('summary');summary.textContent=title;details.append(summary);
  for(const node of nodes){if(node.tagName==='DETAILS'){for(const child of [...node.children])if(child.tagName!=='SUMMARY')details.append(child);node.remove();}else details.append(node);}
  footer.append(details);
 }
 // Move the static methodology blocks into the same bottom-of-page notes area.
 const footer=document.getElementById('page-notes');
 if(footer){[...document.querySelectorAll('main>section.method')].forEach((section,i)=>{
  const details=document.createElement('details');details.className='note-block';details.id=section.id||'funding-method-notes';
  const summary=document.createElement('summary');summary.textContent=i===0?'Workforce · definitions and sources':'Funding and spending · definitions and sources';details.append(summary);
  for(const child of [...section.children])if(child.tagName!=='H2'&&!child.classList.contains('eyebrow'))details.append(child);
  section.remove();footer.append(details);
 });}
 window.AtlasNotes={collect};
 document.addEventListener('click',e=>{const link=e.target.closest('a[href^="#"]');if(!link)return;const id=link.getAttribute('href').slice(1);const target=document.getElementById(id);if(!target||!target.closest('#page-notes'))return;
  for(let node=target;node;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;
  e.preventDefault();history.replaceState(null,'','#'+id);target.scrollIntoView({behavior:'smooth',block:'start'});target.setAttribute('tabindex','-1');target.focus({preventScroll:true});
 });
})();
