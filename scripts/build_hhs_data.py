#!/usr/bin/env python3
"""Extract every table row from the official HHS register; keep source page/row."""
import collections,datetime,decimal,hashlib,json,pathlib,re
import pdfplumber
ROOT=pathlib.Path(__file__).resolve().parents[1];path=ROOT/'data/raw/hhs-grants-terminated.pdf'
def text(s):return ' '.join((s or '').split())
def dollars(s):
 s=text(s)
 if s in ('','-'):return None
 assert re.fullmatch(r'\(?-?\$?[\d,]+(?:\.\d{2})?\)?',s),s
 return float(decimal.Decimal(s.replace('$','').replace(',','').replace('(','-').replace(')','')))
records=[];page_counts=[]
with pdfplumber.open(path) as pdf:
 source_date=datetime.datetime.strptime(pdf.metadata['CreationDate'][2:10],'%Y%m%d').date().isoformat();page_count=len(pdf.pages)
 for page_no,page in enumerate(pdf.pages,1):
  tables=page.extract_tables();assert len(tables)==1,(page_no,len(tables));count=0
  for row_no,row in enumerate(tables[0],1):
   assert len(row)==14,(page_no,row_no,len(row));row=[text(v) for v in row]
   if row[0]=='OPDIV':continue
   assert row[0] and row[1] and row[2],(page_no,row_no,row)
   date=datetime.datetime.strptime(row[6],'%m/%d/%Y').date().isoformat()
   records.append({'id':f'hhs-{page_no}-{row_no}','opdiv':row[0],'fain':row[1],'document':row[2],'recipient':row[3],'state':row[4],'country':row[5],'action_date':date,'obligated':dollars(row[7]),'expended':dollars(row[8]),'payment_at_termination':dollars(row[9]),'unliquidated_at_termination':dollars(row[10]),'title':row[11],'action':row[12],'for_cause':row[13]=='X','page':page_no,'row':row_no});count+=1
  page_counts.append(count)
  if page_no%15==0:print('Parsed',page_no,'pages;',len(records),'rows',flush=True)
keys=collections.Counter((r['opdiv'],r['fain'],r['document'],r['action_date']) for r in records)
output={'source':'https://taggs.hhs.gov/Content/Data/HHS_Grants_Terminated.pdf','retrieved_on':'2026-11-07','source_created_on':source_date,'source_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'pages':page_count,'page_counts':page_counts,'coverage':'All rows in the November 6, 2026 HHS register. One row is an obligation-document record, not necessarily a unique award. Multiple documents can share a FAIN.','limitations':'The register includes different action types, including bilateral and for-cause terminations. An action is not automatically attributable to administration policy. Dash monetary cells remain missing. Unliquidated obligations at termination are not verified savings, current balance or rebuilding cost. Inclusion does not establish present legal status.','duplicate_document_keys':sum(v-1 for v in keys.values() if v>1),'records':records}
(ROOT/'data/hhs-program-actions.json').write_text(json.dumps(output,separators=(',',':'),allow_nan=False)+'\n')
print('Published',len(records),'rows;',len(set((r['opdiv'],r['fain']) for r in records)),'distinct FAINs;',output['duplicate_document_keys'],'duplicate document keys')
print('Actions',collections.Counter(r['action'] for r in records))
