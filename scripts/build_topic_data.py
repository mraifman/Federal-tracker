#!/usr/bin/env python3
"""Publish all 2009–27 budget rows with one official OMB function topic per row."""
import csv,hashlib,json,pathlib
import openpyxl
ROOT=pathlib.Path(__file__).resolve().parents[1]
TOPICS=[('050','Defense'),('150','International affairs'),('250','Science, space & technology'),('270','Energy'),('300','Natural resources & environment'),('350','Agriculture'),('370','Commerce & housing credit'),('400','Transportation'),('450','Community development & disaster relief'),('500','Education, training & social services'),('550','Health'),('570','Medicare'),('600','Income security'),('650','Social Security'),('700','Veterans benefits & services'),('750','Justice'),('800','General government'),('900','Net interest'),('920','Allowances'),('950','Undistributed offsetting receipts')]
NAMES=dict(TOPICS);CODES=[int(c) for c,n in TOPICS]
years=[str(y) for y in range(2009,2028)]
path=ROOT/'data/raw/budauth_fy2027.xlsx';sheet=openpyxl.load_workbook(path,read_only=True,data_only=True).active;it=sheet.iter_rows(values_only=True);headers=list(next(it));ix=[headers.index(y) for y in years];records=[]
for rowno,r in enumerate(it,2):
 vals=[r[i] for i in ix];assert all(isinstance(v,(int,float)) for v in vals)
 if not any(vals):continue
 sub=int(r[8]);parent=max(c for c in CODES if c<=sub);assert sub-parent<20,(sub,parent)
 code=f'{parent:03d}'
 records.append({'id':str(rowno),'row':rowno,'topic_code':code,'topic':NAMES[code],'subtopic_code':r[8],'subtopic':r[9],'classification_basis':'OMB source subfunction → official parent function, FY2027 database guide Table 2','classification_status':'official','agency_code':r[0],'agency':r[1],'bureau_code':r[2],'bureau':r[3],'account_code':r[4],'account':r[5],'category':r[10],'values':dict(zip(years,[int(v)*1000 for v in vals]))})
data={'source':'https://www.whitehouse.gov/wp-content/uploads/2026/04/budauth_fy2027.xlsx','taxonomy_source':'https://www.whitehouse.gov/wp-content/uploads/2026/04/db_guide_fy2027.pdf','source_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'retrieved_on':'2026-11-07','years':years,'status':{y:'actual' if int(y)<=2025 else 'estimate' if y=='2026' else 'proposal' for y in years},'topics':[{'code':c,'name':n} for c,n in TOPICS],'totals':{y:sum(r['values'][y] for r in records) for y in years},'records':records,'limitations':'Nominal net budget authority, not outlays or restoration costs. Historical accounts are restated by OMB. Fiscal years do not coincide with administrations. A primary function topic is assigned once per source row; cross-cutting themes such as climate are not inferred from names. Budget amounts at the exact January 19, 2025 date are not supplied by this annual dataset.'}
(ROOT/'data/topic-budget.json').write_text(json.dumps(data,separators=(',',':'),allow_nan=False)+'\n')
fred=ROOT/'data/raw/fred-ces9091000001.csv';obs=[]
for i,r in enumerate(csv.DictReader(fred.open()),2):
 if r['observation_date']<'2009-01-01':continue
 v=r['CES9091000001'];obs.append({'date':r['observation_date'],'value':None if v in ('','.','NA') else float(v),'source_row':i})
national={'id':'CES9091000001','source':'https://fred.stlouisfed.org/series/CES9091000001','download':'https://fred.stlouisfed.org/graph/fredgraph.csv?id=CES9091000001','source_sha256':hashlib.sha256(fred.read_bytes()).hexdigest(),'retrieved_on':'2026-11-07','title':'All Employees, Federal','unit':'Thousands of persons','adjustment':'Seasonally adjusted','frequency':'Monthly','producer':'U.S. Bureau of Labor Statistics, Current Employment Statistics','baseline_month':'2025-01-01','limitations':'National payroll employment estimate, not OPM agency headcount, service output or a hiring target. Reference is the pay period containing the 12th; month labels are not inauguration-day observations. Do not splice CES levels into OPM series. Subject to revisions.','observations':obs}
(ROOT/'data/national-employment.json').write_text(json.dumps(national,separators=(',',':'))+'\n')
print('Topic-coded budget rows:',len(records),'topics:',len(set(r['topic_code'] for r in records)),'years',years[0],years[-1]);print('National employment months:',len(obs),'latest',obs[-1])
