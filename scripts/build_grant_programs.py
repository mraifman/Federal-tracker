#!/usr/bin/env python3
"""Awarding-department grant obligations by Assistance Listing, with full pagination."""
import concurrent.futures,hashlib,json,pathlib,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[1];CACHE=pathlib.Path('/tmp/federal-atlas-grant-programs');CACHE.mkdir(exist_ok=True)
URL='https://api.usaspending.gov/api/v2/search/spending_by_category/cfda/'
def fetch(job):
 code,name,tier,year=job;records=[];sources=[];page=1
 while True:
  body={'filters':{'time_period':[{'start_date':f'{year-1}-10-01','end_date':f'{year}-08-31'}],'agencies':[{'type':'awarding','tier':tier,'name':name}],'award_type_codes':['02','03','04','05']},'category':'cfda','spending_level':'transactions','limit':100,'page':page}
  key=hashlib.sha256(json.dumps(body,sort_keys=True).encode()).hexdigest();p=CACHE/(key+'.json')
  if not p.exists():
   raw=subprocess.check_output(['curl','-fsSL','--retry','1','--max-time','55','-H','Content-Type: application/json','-d',json.dumps(body),URL]);json.loads(raw);p.write_bytes(raw)
  raw=p.read_bytes();d=json.loads(raw);records+=d['results'];sources.append({'url':URL,'request':body,'sha256':hashlib.sha256(raw).hexdigest(),'page':page})
  if not d['page_metadata']['hasNext']:break
  page+=1;assert page<100,'Unexpected pagination'
 assert len({r['id'] for r in records})==len(records)
 return code,str(year),{'programs':records,'total':sum(r['amount'] for r in records),'sources':sources,'empty_result':not bool(records)}
def main():
 agencies=json.loads((ROOT/'data/agencies.json').read_text())['agencies'];units=[(r['code'],r['name'],'toptier') for r in agencies]+[('NIH','National Institutes of Health','subtier')];result={code:{'code':code,'name':name,'tier':tier,'years':{}} for code,name,tier in units};errors=[]
 jobs=[(code,name,tier,year) for code,name,tier in units for year in [2024,2026]]
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
  tasks={pool.submit(fetch,j):j for j in jobs}
  for i,f in enumerate(concurrent.futures.as_completed(tasks),1):
   try:code,year,data=f.result();result[code]['years'][year]=data
   except Exception as e:errors.append({'unit':tasks[f][0],'year':tasks[f][3],'error':str(e)})
   if i%25==0:print('Grant-program comparisons:',i,'/',len(jobs),flush=True)
 complete=[r for r in result.values() if len(r['years'])==2];assert len(complete)>=105,errors
 output={'retrieved_on':'2026-11-07','definition':'Net grant-award transaction obligations by awarding agency and Assistance Listing (formerly CFDA). Types 02 block grants, 03 formula grants, 04 project grants and 05 cooperative agreements. Same October–August periods in FY2024 and FY2026. This is grants issued, not all account spending or all funding supplied by the department. It excludes direct payments, loans, contracts and subawards.','agency_basis':'awarding','period_label':'October–August','program_classification':'Official Assistance Listing code and title from USAspending; titles can change while codes remain stable. No program code/name is manually invented.','records':list(result.values()),'errors':errors,'limitations':['Absence of grant transactions is not proof that a program was canceled.','No result for a program means no matching reported transaction in this query, not verified zero authorized funding.','Net obligations include deobligations and can be negative; shares are net shares, not recipient counts or service outcomes.','Funding-agency and awarding-agency populations differ; these grant totals are not assumed to reconcile to object-class account obligations.']}
 (ROOT/'data/grant-programs.json').write_text(json.dumps(output,separators=(',',':'),allow_nan=False)+'\n');print('Published',len(complete),'paired units;',len(errors),'errors',flush=True)
if __name__=='__main__':main()
