#!/usr/bin/env python3
"""SF133 reported authority and execution, all published monthly agency workbooks."""
import concurrent.futures,hashlib,json,pathlib,re,subprocess,urllib.parse,warnings
import openpyxl
warnings.filterwarnings('ignore',category=UserWarning)
ROOT=pathlib.Path(__file__).resolve().parents[1];CACHE=pathlib.Path('/tmp/federal-atlas-sf133');CACHE.mkdir(exist_ok=True)
BASE='https://portal.max.gov/portal/document/SF133/Budget/'
METRICS={'4180':'net_authority','1900':'gross_authority','1160':'appropriations','1260':'appropriations','2190':'obligations','4190':'net_outlays'}
budget=json.loads((ROOT/'data/topic-budget.json').read_text());mapping={}
for r in budget['records']:
 k=(r['agency_code'],r['bureau_code'].zfill(2),r['account_code'].zfill(4));mapping.setdefault(k,[]).append(r)
def download(job):
 year,url=job;p=CACHE/(str(year)+'-'+url.rsplit('/',1)[-1])
 if not p.exists():subprocess.run(['curl','-fsSL','--retry','2','--max-time','120',url,'-o',str(p)],check=True)
 return year,url,p

def parse(job):
 year,url,p=job;w=openpyxl.load_workbook(p,read_only=True,data_only=True);s=w['Raw Data'];it=s.values;h={str(v):i for i,v in enumerate(next(it))};records={};count=0;labels={};seen=set();repeated=0
 for rowno,r in enumerate(it,2):
  line=str(r[h['LINENO']]).strip()
  if line not in METRICS:continue
  val=r[h['AMT4']]
  if val is None:continue
  account=str(r[h['OMB_ACCT']]).strip();match=re.match(r'(\d{3})-(\d+)-(\d{4})\s+(.*)',account)
  if not match:continue
  ag,bu,ac,name=match.groups();bu=bu.zfill(2);credit=str(r[h['CRED_IND']]).strip();treasury=str(r[h['TRAG']]).strip().zfill(3)+'-'+str(r[h['TRACCT']]).strip().zfill(4);key='-'.join([ag,bu,ac])+'|'+treasury+'|'+credit
  unique=(str(r[h['TAFS']]),str(r[h.get('COHORT',0)]),line,str(r[h.get('CRED_IND',0)]))
  if unique in seen:repeated+=1
  seen.add(unique)
  if key not in records:
   candidates=mapping.get((ag,bu,ac),[]);topics={x['topic_code'] for x in candidates};subtopics={x['subtopic_code'] for x in candidates};mapped=candidates[0] if len(topics)==1 else None
   records[key]={'id':key,'agency_code':ag,'bureau_code':bu,'account_code':ac,'agency':str(r[h['AGENCY']]).strip(),'bureau':str(r[h['BUREAU']]).strip(),'account':str(r[h['TAFS']]).split(' - ',1)[-1].strip(),'omb_account':name.strip(),'treasury_account':treasury,'credit_scope':credit,'topic_code':mapped['topic_code'] if mapped else 'unclassified','topic':mapped['topic'] if mapped else 'Unclassified — review needed','subtopic_code':mapped['subtopic_code'] if mapped and len(subtopics)==1 else None,'classification_basis':'Exact OMB agency/bureau/account code → unique function in FY2027 budget database' if mapped else 'No unique reviewed OMB account-function match','classification_status':'official_account_crosswalk' if mapped else 'unclassified','metrics':{},'source_rows':[],'source_index':None}
  rec=records[key];metric=METRICS[line];rec['metrics'][metric]=rec['metrics'].get(metric,0)+float(val);rec['source_rows'].append({'row':rowno,'line':line});count+=1;labels[line]=str(r[h['LINE_DESC']]).strip()
 source={'url':url,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'year':year,'sheet':'Raw Data','column':'AMT4','report_period':'September (fourth quarter)','retained_source_rows':count,'repeated_tafs_line_keys_retained':repeated}
 w.close();return source,list(records.values()),labels

def main():
 jobs=[]
 for yr in [2024,2026]:
  index_path=CACHE/(f'index-{yr}.html')
  if not index_path.exists():
   index_url=BASE+urllib.parse.quote(f'FY {yr} - SF 133 Reports on Budget Execution and Budgetary Resources.html')
   subprocess.run(['curl','-fsSL','--max-time','45',index_url,'-o',str(index_path)],check=True)
  html=index_path.read_text()
  links=re.findall(r'<a href="([^"]+\.xlsx)"[^>]*data-linked-resource-default-alias="[^"]*SF133_MONTHLY[^"]*"',html)
  if not links:links=re.findall(r'href="([^"]+SF133_MONTHLY[^"]+\.xlsx)"',html)
  assert len(set(links))>=28,(yr,len(links))
  jobs +=[(yr,urllib.parse.urljoin(BASE,x)) for x in dict.fromkeys(links)]
 print('Downloading',len(jobs),'official agency workbooks',flush=True)
 downloaded=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
  for i,result in enumerate(pool.map(download,jobs),1):
   downloaded.append(result)
   if i%10==0:print('Downloaded',i,flush=True)
 combined={};sources=[];labels={}
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  for i,(source,records,desc) in enumerate(pool.map(parse,downloaded),1):
   idx=len(sources);sources.append(source);yr=str(source['year']);labels.update(desc)
   for r in records:
    key=r['id'];value={'metrics':r.pop('metrics'),'source_rows':r.pop('source_rows'),'source_index':idx}
    if key not in combined:combined[key]={k:v for k,v in r.items() if k!='source_index'}|{'years':{}}
    assert yr not in combined[key]['years'],('Duplicate account between source workbooks',key,yr)
    combined[key]['years'][yr]=value
   if i%10==0:print('Parsed',i,'workbooks',flush=True)
 out={'retrieved_on':'2026-11-07','baseline':'FY2024','comparison':'FY2026','definition':'Agency-reported SF133 actual budget authority and execution, September/fourth-quarter AMT4. Not presidential requests. Net budget authority (line 4180) includes offsets; appropriations (1160 + 1260) reflect reported transfers, reductions and adjustments. These are execution reports, not a normalized line-by-line legal appropriations database. FY2027 continuing resolutions are not annualized into these totals.','line_definitions':labels,'sources':sources,'records':list(combined.values()),'limitations':['Last full Biden fiscal year FY2024 versus latest completed Trump fiscal year FY2026; not January 19 point-in-time budgets.','Non-financing accounts are the default; financing accounts are retained separately.','Missing source years and absent line metrics remain unknown, not zero.','Account topics crosswalk exact OMB codes; unmatched accounts remain explicitly unclassified.','Cross-cutting climate-specific amounts require finer program allocations; an environment/energy account total is not all climate spending.']}
 (ROOT/'data/authority-comparison.json').write_text(json.dumps(out,separators=(',',':'),allow_nan=False)+'\n');print('Published',len(combined),'accounts from',len(sources),'workbooks',flush=True)
 from classify_authority import main as classify
 classify()
if __name__=='__main__':main()
