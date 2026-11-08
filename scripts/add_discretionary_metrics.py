#!/usr/bin/env python3
"""Retain reported discretionary SF133 lines without allocating mixed accounts."""
import hashlib,json,pathlib,re,warnings
import openpyxl
warnings.filterwarnings('ignore',category=UserWarning)
ROOT=pathlib.Path(__file__).resolve().parents[1]
LINES={'4070':'discretionary_net_authority','4000':'discretionary_gross_authority','1160':'discretionary_appropriations','4080':'discretionary_net_outlays'}
def main():
 path=ROOT/'data/authority-comparison.json';data=json.loads(path.read_text());by_id={r['id']:r for r in data['records']};count=0
 for source in data['sources']:
  p=pathlib.Path('/tmp/federal-atlas-sf133')/(str(source['year'])+'-'+source['url'].rsplit('/',1)[-1])
  assert hashlib.sha256(p.read_bytes()).hexdigest()==source['sha256'],str(p)
  w=openpyxl.load_workbook(p,read_only=True,data_only=True);it=w['Raw Data'].values;h={str(v):i for i,v in enumerate(next(it))}
  year=str(source['year'])
  for r in data['records']:
   y=r['years'].get(year)
   if y and data['sources'][y['source_index']]['url']==source['url']:
    y['discretionary_source_rows']=[]
    for metric in LINES.values():y['metrics'].pop(metric,None)
  for rowno,row in enumerate(it,2):
   line=str(row[h['LINENO']]).strip();amount=row[h['AMT4']]
   if line not in LINES or amount is None:continue
   match=re.match(r'(\d{3})-(\d+)-(\d{4})\s+(.*)',str(row[h['OMB_ACCT']]).strip())
   if not match:continue
   ag,bu,ac,_=match.groups();treasury=str(row[h['TRAG']]).strip().zfill(3)+'-'+str(row[h['TRACCT']]).strip().zfill(4)
   key=f'{ag}-{bu.zfill(2)}-{ac}|{treasury}|{str(row[h["CRED_IND"]]).strip()}'
   if key not in by_id:continue
   y=by_id[key]['years'].get(year)
   if not y:continue
   metric=LINES[line];y['metrics'][metric]=y['metrics'].get(metric,0)+float(amount)
   y['discretionary_source_rows'].append({'row':rowno,'line':line});data['line_definitions'][line]=str(row[h['LINE_DESC']]).strip();count+=1
  w.close()
 data['discretionary_definition']='Reported discretionary SF133 lines only: net budget authority 4070, gross authority 4000, appropriations 1160, net outlays 4080. Mandatory amounts are excluded even within mixed accounts. Unreported measures remain unavailable; no proportional allocation or mandatory-inclusive fallback.'
 path.write_text(json.dumps(data,separators=(',',':'),allow_nan=False)+'\n');print('Retained',count,'discretionary source rows')
if __name__=='__main__':main()
