#!/usr/bin/env python3
"""Validate evidence scope and review coverage without inferring court outcomes."""
import datetime,gzip,json,pathlib,urllib.parse
ROOT=pathlib.Path(__file__).resolve().parents[1]
def main():
 data=json.loads((ROOT/'data/legal-cases.json').read_text());queue=json.loads((ROOT/'data/legal-review-queue.json').read_text())
 ids=[c['id'] for c in data['cases']];assert len(ids)==len(set(ids))
 unit=json.loads(gzip.decompress((ROOT/'data/outbound/ALL.json.gz').read_bytes()))
 recs=json.loads(gzip.decompress((ROOT/unit['recipients_file']).read_bytes()))
 actual={(r['program_code'],r['recipient_id']):r['recipient_name'] for r in recs}
 for case in data['cases']:
  for field in ['checked_on','next_review_on']:datetime.date.fromisoformat(case[field])
  assert case['next_review_on']>=case['checked_on']
  sources={s['id']:s for s in case['sources']};assert any(s['kind']=='court_order' for s in sources.values())
  for source in sources.values():assert urllib.parse.urlparse(source['url']).scheme=='https'
  for scope in case['scopes']:
   assert scope['program_code'] and scope['recipient_ids']
   assert set(scope['source_ids'])<=sources.keys()
   assert len(scope['recipient_ids'])==len(scope['recipient_names'])
   for rid,name in zip(scope['recipient_ids'],scope['recipient_names']):assert actual[scope['program_code'],rid]==name
  for event in case['timeline']:
   datetime.date.fromisoformat(event['date']);assert event['source_id'] in sources
 for review in data['reviews']:
  assert review['outcome']=='not_identified' and review['searches']
  datetime.date.fromisoformat(review['checked_on'])
  for search in review['searches']:assert search['query'] and search['url'].startswith('https://')
 cov=queue['coverage'];assert cov['programs_screened']==cov['programs_not_reviewed']+cov['programs_with_related_cases']+cov['programs_with_documented_search']
 assert cov['flagged_programs']==len(queue['queue'])
 assert all(r['review_state'] in ['related_unverified','not_identified','not_reviewed'] for r in queue['queue'])
 assert all(r['signals'] and r['search_query'] for r in queue['queue'])
 print(f"Validated {len(ids)} case, exact program/recipient links, dated evidence and {len(queue['queue'])} financial review flags.")
if __name__=='__main__':main()
