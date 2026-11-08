/* Evidence-only legal annotations; no financial adjustments or fuzzy party matches. */
(()=>{'use strict';
 function assess(registry,{programCode,recipientId,today=new Date().toISOString().slice(0,10)}={}){
  if(!registry)return {state:'unavailable',label:'Review data unavailable',cases:[],overdue:false};
  const cases=(registry.cases||[]).filter(c=>c.scopes.some(s=>s.program_code===programCode));
  const matched=cases.filter(c=>c.scopes.some(s=>s.program_code===programCode&&s.recipient_ids.includes(recipientId)));
  const review=(registry.reviews||[]).find(r=>r.program_code===programCode&&(!r.recipient_id||r.recipient_id===recipientId));
  const state=matched.length?'verified':cases.length?'related_unverified':review?.outcome==='not_identified'?'not_identified':'not_reviewed';
  const linked=matched.length?matched:cases;
  return {state,label:registry.states[state],cases:linked,review:review||null,overdue:linked.some(c=>c.next_review_on<today)};
 }
 const api={assess};if(typeof module!=='undefined'&&module.exports)module.exports=api;else window.AtlasLegalReview=api;
})();
