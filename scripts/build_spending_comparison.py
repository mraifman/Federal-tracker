#!/usr/bin/env python3
"""Paired, fiscal-period-matched official account spending across the agency directory."""
import concurrent.futures,hashlib,json,pathlib,subprocess,time
ROOT=pathlib.Path(__file__).resolve().parents[1]
CACHE=pathlib.Path('/tmp/federal-atlas-spending');CACHE.mkdir(exist_ok=True)
URL='https://api.usaspending.gov/api/v2/spending/'
AGENCY_IDS={}
def request(url,payload=None):
 key=hashlib.sha256((url+json.dumps(payload,sort_keys=True)).encode()).hexdigest();p=CACHE/(key+'.json')
 if not p.exists():
  args=['curl','-fsSL','--retry','2','--max-time','55','-H','Content-Type: application/json']
  if payload is not None:args+=['-d',json.dumps(payload)]
  raw=subprocess.check_output(args+[url]);json.loads(raw);p.write_bytes(raw)
 raw=p.read_bytes();return json.loads(raw),{'url':url,'request':payload,'sha256':hashlib.sha256(raw).hexdigest()}
def fetch_agency(a):
 record={'code':a['code'],'name':a['name'],'years':{}}
 for yr in [2024,2026]:
  y={}
  for kind in ['object_class','federal_account']:
   payload={'type':kind,'filters':{'fy':str(yr),'period':'11','agency':AGENCY_IDS.get(yr,{}).get(a['code'],a['raw']['agency_id'])}}
   d,source=request(URL,payload)
   assert d['end_date'].startswith(str(yr)+'-08-31'),(a['code'],yr,d['end_date'])
   vals=d['results'];total=d['total'];summed=sum(r['amount'] for r in vals)
   assert total is None or abs(summed-total)<max(2,abs(total)*1e-8),(a['code'],kind,total,summed)
   y[kind]={'total':total,'end_date':d['end_date'],'records':vals,'source':source}
  record['years'][str(yr)]=y
 return record

def fetch_nih_account(account):
 detail,lookup=request(f'https://api.usaspending.gov/api/v2/federal_accounts/{account}/?fiscal_year=2026')
 result={'id':account,'name':detail['account_title'],'lookup_source':lookup,'years':{}}
 for yr in [2024,2026]:
  body={'type':'object_class','filters':{'fy':str(yr),'period':'11','agency':806,'federal_account':detail['id']}}
  d,source=request(URL,body)
  assert d['end_date'].startswith(f'{yr}-08-31')
  rows=[{'code':r['code'],'name':r['name'],'obligations':r['amount']} for r in d['results']]
  assert d['total'] is None or abs(sum(r['obligations'] for r in rows)-d['total'])<2
  result['years'][str(yr)]={'records':rows,'sources':[source],'total':d['total'],'end_date':d['end_date']}
 return result

def main():
 agencies=json.loads((ROOT/'data/agencies.json').read_text())['agencies'];records=[];errors=[];agency_index_sources=[]
 for yr in [2024,2026]:
  d,source=request(URL,{'type':'agency','filters':{'fy':str(yr),'period':'11'}});AGENCY_IDS[yr]={r['code']:int(r['id']) for r in d['results'] if r.get('id') and r.get('code')};agency_index_sources.append(source)
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
  futures={pool.submit(fetch_agency,a):a for a in agencies}
  for i,f in enumerate(concurrent.futures.as_completed(futures),1):
   try:records.append(f.result())
   except Exception as e:errors.append({'code':futures[f]['code'],'error':str(e)})
   if i%20==0:print('Agency spending:',i,'/',len(agencies),flush=True)
 assert len(records)>=100,errors
 # The bureau's federal-account membership comes directly from USAspending, not name matching.
 bureau_sources=[];account_ids=set();memberships={}
 for year in [2024,2026]:
  url=f'https://api.usaspending.gov/api/v2/agency/075/sub_components/national-institutes-of-health/?fiscal_year={year}&limit=100'
  d,source=request(url);assert not d['page_metadata']['hasNext'];bureau_sources.append(source)
  memberships[str(year)]=d['results'];account_ids|={r['id'] for r in d['results']}
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:nih=list(pool.map(fetch_nih_account,sorted(account_ids)))
 out={'retrieved_on':'2026-11-07','baseline_fiscal_year':2024,'comparison_fiscal_year':2026,'fiscal_period':11,'period_label':'October–August, cumulative obligations','definition':'Fiscal-year-to-date account obligations, not appropriations, cash payments or award obligations. Same eleven fiscal months in each year. Negative obligations are retained. Categories describe what money was obligated for, not a causal explanation of staffing changes.','coverage':'USAspending top-tier agency directory; not every federal entity. Missing or unavailable submissions may remain in reported data.','records':sorted(records,key=lambda r:r['name']),'errors':errors,'agency_index_sources':agency_index_sources,'nih':{'definition':'Official NIH bureau account membership in FY2024 or FY2026, with matched October–August object-class obligations. Includes revolving funds and offsets; not identical in scope to OMB NIH budget authority or OPM employees.','memberships':memberships,'sources':bureau_sources,'accounts':nih}}
 (ROOT/'data/spending-comparison.json').write_text(json.dumps(out,separators=(',',':'),allow_nan=False)+'\n');print('Published',len(records),'agencies;',len(nih),'NIH accounts;',len(errors),'errors',flush=True)
if __name__=='__main__':main()
