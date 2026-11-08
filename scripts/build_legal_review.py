#!/usr/bin/env python3
"""Screen every displayed program for financial signals; never infer litigation.
Run after an award rebuild or during the daily refresh. Only a documented human
source review can change checked_on or mark a court finding verified.
"""
import argparse,datetime,gzip,json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
def screen(rows,excluded,registry,as_of):
 programs={}
 for r in rows:
  if r['basis']!='funding' or r['program_code'] in excluded:continue
  p=programs.setdefault(r['program_code'],{'program_code':r['program_code'],'name':r['program_name'],'baseline':0,'comparison':0,'current_transactions':0})
  p['baseline' if r['year']==2024 else 'comparison']+=r['amount'] or 0
  if r['year']==2026:p['current_transactions']+=r.get('transaction_count',0)
 linked={s['program_code'] for c in registry['cases'] for s in c['scopes']}
 reviewed={r['program_code'] for r in registry['reviews'] if not r.get('recipient_id')}
 queue=[]
 for code,p in programs.items():
  a,b=p['baseline'],p['comparison'];flags=[]
  if b-a<=-1e9:flags.append('At least $1B less in annual obligations')
  if a>=1e8 and not p['current_transactions']:flags.append('No FY2026 transactions after at least $100M in FY2024')
  if b<=-1e8:flags.append('Negative FY2026 net obligations of at least $100M')
  if not flags:continue
  state='related_unverified' if code in linked else 'not_identified' if code in reviewed else 'not_reviewed'
  queue.append({**p,'change':b-a,'signals':flags,'review_state':state,'search_query':f'"{p["name"]}" "{code}" termination injunction court'})
 queue.sort(key=lambda p:-abs(p['change']))
 return {'generated_on':as_of,'definition':'Automated financial screening, not an automated court search. Flags prioritize investigation; they do not establish cancellation, illegality, or a court finding. No current-year transactions can reflect a multi-year award made earlier.',
 'coverage':{'programs_screened':len(programs),'programs_with_related_cases':len(linked&programs.keys()),'programs_with_documented_search':len(reviewed&programs.keys()),'programs_not_reviewed':len(programs.keys()-linked-reviewed),'flagged_programs':len(queue)},
 'cases_due_for_review':[c['id'] for c in registry['cases'] if c['next_review_on']<as_of], 'queue':queue}
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--as-of',default=datetime.date.today().isoformat());args=parser.parse_args()
 registry=json.loads((ROOT/'data/legal-cases.json').read_text());policy=json.loads((ROOT/'data/mandatory-benefit-programs.json').read_text())
 index=json.loads((ROOT/'data/outbound-awards.json').read_text());unit=next(u for u in index['units'] if u['code']=='ALL');path=ROOT/unit['file'];rows=json.loads(gzip.decompress(path.read_bytes()))['programs']
 output=screen(rows,policy['programs'],registry,args.as_of)
 (ROOT/'data/legal-review-queue.json').write_text(json.dumps(output,separators=(',',':'),allow_nan=False)+'\n')
 print('Legal review screening:',output['coverage'])
if __name__=='__main__':main()
