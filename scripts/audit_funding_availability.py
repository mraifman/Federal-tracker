#!/usr/bin/env python3
"""Explain missing metrics conservatively; reconcile zero authority from SF133 identities."""
import concurrent.futures,hashlib,json,pathlib,re,warnings
import openpyxl
warnings.filterwarnings('ignore',category=UserWarning)
ROOT=pathlib.Path(__file__).resolve().parents[1];CACHE=pathlib.Path('/tmp/federal-atlas-sf133')
def scan(source):
 p=CACHE/(str(source['year'])+'-'+source['url'].rsplit('/',1)[-1]);assert hashlib.sha256(p.read_bytes()).hexdigest()==source['sha256']
 cache=CACHE/(p.name+'.audit.json')
 if cache.exists():return json.loads(cache.read_text())
 w=openpyxl.load_workbook(p,read_only=True,data_only=True);it=w['Raw Data'].values;h={str(k):i for i,k in enumerate(next(it))};accounts={}
 for rowno,r in enumerate(it,2):
  name=str(r[h['OMB_ACCT']]).strip();match=re.match(r'(\d{3})-(\d+)-(\d{4})\s+',name)
  if not match:continue
  ag,bu,ac=match.groups();treasury=str(r[h['TRAG']]).strip().zfill(3)+'-'+str(r[h['TRACCT']]).strip().zfill(4);key='-'.join([ag,bu.zfill(2),ac])+'|'+treasury+'|'+str(r[h['CRED_IND']]).strip();line=str(r[h['LINENO']]).strip();v=r[h['AMT4']]
  if v is None:continue
  rec=accounts.setdefault(key,{'tafs':{},'totals':{},'rows':{}});tafs=str(r[h['TAFS']])+'|'+str(r[h['COHORT']]);t=rec['tafs'].setdefault(tafs,{})
  t[line]=t.get(line,0)+float(v);rec['totals'][line]=rec['totals'].get(line,0)+float(v);rec['rows'].setdefault(line,[]).append(rowno)
 w.close();cache.write_text(json.dumps(accounts,separators=(',',':')));return accounts

def main():
 p=ROOT/'data/authority-comparison.json';d=json.loads(p.read_text());by_source={};derived=0
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  for idx,accounts in enumerate(pool.map(scan,d['sources'])):
   by_source[idx]=accounts
   if (idx+1)%10==0:print('Audited',idx+1,'source workbooks',flush=True)
 for r in d['records']:
  for year,y in r['years'].items():
   y['supplementary_source_rows']=[]
   y.pop('derived_metrics',None)
   source=by_source[y['source_index']].get(r['id'])
   if source is None:continue
   for code,metric in [('2500','resources'),('2490','unobligated_balance')]:
    if code in source['totals']:
     y['metrics'][metric]=source['totals'][code]
     y.setdefault('supplementary_source_rows',[]).extend({'row':n,'line':code} for n in source['rows'][code])
   # Only a complete, explicit resource/balance identity supports this reconstruction.
   tafs=list(source['tafs'].values());support=bool(tafs)
   for t in tafs:
    if '1910' not in t or '1070' not in t or abs(t['1910']-t['1070'])>.01:support=False;break
    if any(abs(v)>.01 for code,v in t.items() if code.isdigit() and (1100<=int(code)<=1900 or int(code) in [4000,4040,4060,4070,4090,4130,4150,4160])):support=False;break
   if support:
    evidence=[{'row':n,'line':code} for code in ['1070','1910'] for n in source['rows'].get(code,[])]
    for metric in ['net_authority','gross_authority','appropriations']:
     if metric not in y['metrics']:
      y.setdefault('derived_metrics',{})[metric]={'value':0,'status':'reconciled_zero','basis':'For every reported TAFS, SF133 total resources (1910) equal carried-forward unobligated balances (1070), with no nonzero new-authority or authority-offset lines. This establishes no new authority in this report; it does not establish program closure.','source_rows':evidence};derived+=1
 for r in d['records']:
  current=r['years'].get('2026');prior=r['years'].get('2024');known=current is not None and ('net_authority' in current['metrics'] or 'net_authority' in current.get('derived_metrics',{}))
  if not current:
   candidates=[x for x in d['records'] if x['id']!=r['id'] and x['treasury_account']==r['treasury_account'] and x['credit_scope']==r['credit_scope'] and '2026' in x['years']]
   r['availability']={'status':'possible_account_reclassification' if candidates else 'no_current_source_observation','candidate_successors':[x['id'] for x in candidates],'closure_verified':False,'reason':'Treasury account appears under other OMB coding; a reviewed continuity link is still needed.' if candidates else 'No FY2026 source observation. Closure, expiration, transfer and reporting omission have not been distinguished. Do not assign zero.'}
  elif not known:r['availability']={'status':'metric_not_reported','closure_verified':False,'reason':'Account is present in FY2026, but this authority line is not emitted and a strict zero reconciliation was not established. Spending and balances may still be reported.'}
  else:
   n=current['metrics'].get('net_authority',current.get('derived_metrics',{}).get('net_authority',{}).get('value'))
   r['availability']={'status':'reconciled_zero_authority' if 'net_authority' in current.get('derived_metrics',{}) else 'reported_zero_authority' if n==0 else 'reported_authority','closure_verified':False,'reason':'No new authority in this report; balances and spending are separate measures. This is not evidence of cancellation.' if n==0 else 'FY2026 authority is reported. This alone does not establish whether the original program or organizational delivery model continued.'}
 d['availability_audit']={'checked_on':'2026-11-07','source_workbooks':len(d['sources']),'derived_zero_metrics':derived,'rules':'scripts/audit_funding_availability.py','definition':'A missing source observation is never converted to zero. A zero authority metric is reconstructed only from an explicit SF133 resource/balance identity, with source rows retained. Cancellation and successor status require separate evidence.'}
 p.write_text(json.dumps(d,separators=(',',':'),allow_nan=False)+'\n');print('Reconciled',derived,'zero metrics; missing-year observations remain unknown',flush=True)
if __name__=='__main__':main()
