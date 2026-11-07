#!/usr/bin/env python3
"""Build auditable budget and workforce comparisons from official source files.
Requires openpyxl and pyarrow. Does not impute absent workforce groups as zeros.
"""
import argparse, collections, datetime, hashlib, json, math, pathlib
import openpyxl
import pyarrow.parquet as pq
ROOT=pathlib.Path(__file__).resolve().parents[1]
BUDGET_URL='https://www.whitehouse.gov/wp-content/uploads/2026/04/budauth_fy2027.xlsx'
YEARS=['2024','2025','2026','2027']
def sha(path):return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()
def write(name,obj):
 (ROOT/'data'/name).write_text(json.dumps(obj,ensure_ascii=False,allow_nan=False,separators=(',',':'))+'\n')
def budgets(path):
 sheet=openpyxl.load_workbook(path,read_only=True,data_only=True).active
 it=sheet.iter_rows(values_only=True);headers=list(next(it));indexes=[headers.index(y) for y in YEARS];records=[]
 for row_no,row in enumerate(it,2):
  vals=[row[i] for i in indexes]
  assert all(isinstance(v,(int,float)) and math.isfinite(v) for v in vals),row_no
  if not any(vals):continue
  records.append({'id':str(row_no),'row':row_no,'agency_code':row[0],'agency':row[1],'bureau_code':row[2],'bureau':row[3],'account_code':row[4],'account':row[5],'treasury_agency':row[6],'cgac':row[7],'function_code':row[8],'function':row[9],'category':row[10],'budget_status':row[11],'values':dict(zip(YEARS,[int(v)*1000 for v in vals]))})
 totals={y:sum(r['values'][y] for r in records) for y in YEARS}
 write('budget-changes.json',{'source':BUDGET_URL,'source_sha256':sha(path),'sheet':'Sheet1','retrieved_on':'2026-11-07','vintage':'FY2027 President’s Budget, April 2026','unit':'nominal US dollars','status':{'2024':'actual','2025':'actual','2026':'estimate','2027':'proposal'},'coverage':'All OMB database rows with a nonzero value in FY2024–27; includes offsetting receipts and special budget categories. Net budget authority, not outlays or award obligations. Historical data are restated to current budget structure.','years':YEARS,'totals':totals,'records':records})
 print('Budget:',len(records),'rows;',len(set(r['agency_code'] for r in records)),'agency categories;',totals)
def workforce(paths):
 groups={level:{} for level in ['departments','subagencies','occupations']};totals={};sources=[]
 for period,path,version in paths:
  url=f'https://data.opm.gov/api/v1/files/employment/{period[:4]}/{period[4:]}/{version}/download'
  sources.append({'period':period,'version':version,'url':url,'sha256':sha(path)})
  cols=['department_code','department','agency_subelement_code','agency_subelement','occupational_group_code','occupational_group','count','snapshot_yyyymm']
  counts=collections.Counter();source_rows=0;total=0
  for batch in pq.ParquetFile(path).iter_batches(batch_size=100000,columns=cols):
   for r in batch.to_pylist():
    assert r['snapshot_yyyymm']==period
    weight=int(r['count']);assert weight>0
    total+=weight;source_rows+=1
    dep=r['department_code'] or 'UNSPECIFIED';name=r['department'] or 'Unspecified department'
    keys=[('departments',dep,name,None),('subagencies',dep+'|'+(r['agency_subelement_code'] or 'UNSPECIFIED'),r['agency_subelement'] or 'Unspecified subagency',dep),('occupations',dep+'|'+(r['occupational_group_code'] or 'UNSPECIFIED'),r['occupational_group'] or 'Unspecified occupation',dep)]
    for level,key,title,parent in keys:
     entry=groups[level].setdefault(key,{'id':key,'name':title,'parent':parent,'values':{}})
     entry['name']=title;entry['values'][period]=entry['values'].get(period,0)+weight
  assert sum(r['values'].get(period,0) for r in groups['departments'].values())==total
  totals[period]=total;sources[-1]['source_rows']=source_rows
  print('Workforce:',period,source_rows,'source rows;',total,'weighted count')
 write('workforce-changes.json',{'retrieved_on':'2026-11-07','periods':[x[0] for x in paths],'sources':sources,'totals':totals,'coverage':'All records in OPM EHRI employment extracts. All work schedules; count field summed, not FTEs. EHRI excludes USPS, several intelligence bodies, most legislative/judicial staff and other groups listed by OPM.','limitations':'Net snapshot changes are not layoffs, vacancies or required hiring. Different seasons and reorganizations affect comparisons. Groups absent in either extract remain missing, never zero. September 2026 has approximately 10,000 missing defense Status records according to OPM. August is retained for a less-affected comparison. No automatic correction or imputation is applied.','records':{k:sorted(v.values(),key=lambda r:r['name']) for k,v in groups.items()}})
def main():
 p=argparse.ArgumentParser();p.add_argument('--budget',required=True);p.add_argument('--baseline',required=True);p.add_argument('--latest',required=True);p.add_argument('--september');p.add_argument('--manifest');a=p.parse_args()
 budgets(a.budget);paths=[('202412',a.baseline,4),('202608',a.latest,1)];
 if a.september:paths.append(('202609',a.september,1))
 workforce(json.loads(pathlib.Path(a.manifest).read_text()) if a.manifest else paths)
if __name__=='__main__':main()
