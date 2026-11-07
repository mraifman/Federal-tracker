#!/usr/bin/env python3
"""Apply auditable account-purpose crosswalks without inventing mixed-account allocations."""
import json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
def main():
 path=ROOT/'data/authority-comparison.json';d=json.loads(path.read_text());budget=json.loads((ROOT/'data/topic-budget.json').read_text());index={}
 for r in budget['records']:index.setdefault((r['agency_code'],r['bureau_code'].zfill(2),r['account_code'].zfill(4)),[]).append(r)
 for r in d['records']:
  key=(r['agency_code'],r['bureau_code'],r['account_code']);candidates=index.get(key,[]);basis='Exact OMB agency/bureau/account code'
  if not candidates and key[0]=='016' and key[2] in ['8006','8007']:
   candidates=index.get(('017',key[1],key[2]),[]);basis='Reviewed SSA source-code crosswalk: SF133 016 → OMB database 017 for trust-fund accounts 8006/8007'
  if not candidates and r['agency_code']=='029' and r['account']=='Disability Compensation Benefits':
   candidates=[x for x in budget['records'] if x['agency_code']=='029' and x['account']=='Compensation'];basis='Reviewed new disability compensation account → veterans Compensation purpose; no dollar allocation inferred'
  topics=sorted({x['topic_code'] for x in candidates});r['candidate_topics']=[{'code':t,'name':next(x['topic'] for x in candidates if x['topic_code']==t)} for t in topics]
  if len(topics)==1:
   mapped=candidates[0];r.update(topic_code=topics[0],topic=mapped['topic'],classification_status='reviewed_account_crosswalk',classification_basis=basis+' → unique official OMB primary function',classification_source_rows=sorted({x['row'] for x in candidates}))
  elif len(topics)>1:
   r.update(topic_code='mixed',topic='Mixed purpose — allocation unresolved',classification_status='mixed_account_unallocated',classification_basis=basis+' spans multiple official functions. The actual SF133 amount is retained once, without assigning unsupported shares.',classification_source_rows=sorted({x['row'] for x in candidates}))
 d['classification_source']={'url':budget['source'],'sha256':budget['source_sha256'],'rules':'scripts/classify_authority.py','definition':'An account receives a single purpose only when the official account crosswalk yields one primary function. Mixed-account actual funding is not allocated using estimated shares.'}
 path.write_text(json.dumps(d,separators=(',',':'),allow_nan=False)+'\n')
 print('Classified',sum(r['topic_code'] not in ['mixed','unclassified'] for r in d['records']),'single-purpose accounts;',sum(r['topic_code']=='mixed' for r in d['records']),'mixed;',sum(r['topic_code']=='unclassified' for r in d['records']),'unmatched')
if __name__=='__main__':main()
