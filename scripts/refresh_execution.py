#!/usr/bin/env python3
"""Retrieve all directory agencies' fiscal execution and monthly obligations."""
import concurrent.futures,datetime,json,pathlib,urllib.request,time,math,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[1]
def fetch(a):
 url=f"https://api.usaspending.gov/api/v2/agency/{a['code']}/budgetary_resources/"
 for attempt in range(3):
  try:
   req=urllib.request.Request(url,headers={'User-Agent':'FederalAtlasResearch/1.0'})
   cache=pathlib.Path('/tmp/federal-execution-cache');cache.mkdir(exist_ok=True);file=cache/(a['code']+'.json')
   if file.exists() and time.time()-file.stat().st_mtime<3600:d=json.loads(file.read_text())
   else:
    d=json.loads(subprocess.check_output(['curl','-sS','-L','--fail','--max-time','40',url],text=True))
    file.write_text(json.dumps(d))
   assert d['toptier_code']==a['code'];years=[r for r in d['agency_data_by_year'] if 2023<=r['fiscal_year']<=2027]
   for r in years:
    for k in ['agency_budgetary_resources','agency_total_obligated','agency_total_outlayed']:
     assert r.get(k) is None or (isinstance(r[k],(int,float)) and math.isfinite(r[k]))
    periods=[v['period'] for v in r['agency_obligation_by_period']];assert len(periods)==len(set(periods))
   return {'code':a['code'],'name':a['name'],'source':url,'years':years,'messages':d.get('messages',[])}
  except Exception:
   if attempt==2:raise
   time.sleep(attempt+1)
def main():
 directory=json.loads((ROOT/'data/agencies.json').read_text());records=[];errors=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
  tasks={pool.submit(fetch,a):a for a in directory['agencies']}
  for i,t in enumerate(concurrent.futures.as_completed(tasks),1):
   try:records.append(t.result())
   except Exception as e:errors.append({'code':tasks[t]['code'],'error':str(e)})
   if i%25==0:print('Retrieved',i,'/',len(tasks),flush=True)
 pathlib.Path('/tmp/federal-execution-errors.json').write_text(json.dumps({'errors':errors,'success':len(records)},indent=2));print('Successful:',len(records),'Errors:',len(errors),flush=True)
 assert len(records)>=len(tasks)*.95,'Insufficient coverage; preserving previous output'
 result={'retrieved_on':datetime.datetime.now(datetime.timezone.utc).date().isoformat(),'baseline':'2024-12-31','definition':'Account obligations by fiscal period, not award obligations or appropriations. Fiscal-period values are cumulative within each fiscal year. Budgetary resources include balances carried forward and are not new budget authority.','coverage':directory['coverage'],'records':sorted(records,key=lambda a:a['name']),'errors':errors}
 (ROOT/'data/fiscal-execution.json').write_text(json.dumps(result,separators=(',',':'),allow_nan=False)+'\n');print('Published',len(records),'agencies;',len(errors),'errors')
if __name__=='__main__':main()
