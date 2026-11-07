#!/usr/bin/env python3
"""Parse NSF's official historical termination register, preserving its export date."""
import csv,hashlib,json,pathlib,re
ROOT=pathlib.Path(__file__).resolve().parents[1]
p=ROOT/'data/raw/nsf-terminated-awards.csv'
with p.open(encoding='cp1252',newline='') as f:
 reader=csv.DictReader(f);assert reader.fieldnames[-1]=='Date of export: 6/5/2025';records=[]
 for rownum,r in enumerate(reader,2):
  award=r['Award ID'].strip();assert award.isdigit()
  amount=r['Obligated'].strip().replace('$','').replace(',','');assert re.fullmatch(r'\d+(\.\d+)?',amount)
  records.append({'id':award,'row':rownum,'directorate':r['Directorate'].strip(),'recipient':r['Recipient'].strip(),'title':r['Title'].strip(),'obligated':int(float(amount))})
assert len(set(r['id'] for r in records))==len(records)
data={'source':'https://nsf-gov-resources.nsf.gov/files/NSF-Terminated-Awards.csv','context':'https://www.nsf.gov/updates-on-priorities','source_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'exported_on':'2025-06-05','retrieved_on':'2026-11-07','coverage':'All 1,667 awards in NSF’s official June 5, 2025 termination register. This is a historical list, not a current-status register or a government-wide program inventory. Awards are not whole programs.','limitations':'Obligated is the original field in the register, not the unspent balance, amount cut, savings or rebuilding cost. Later reinstatements are not reflected; NSF subsequently described 114 reinstatements as of June 30, 2025.','records':records}
(ROOT/'data/program-changes.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
print('NSF',len(records),'awards;',sum(r['obligated'] for r in records),'associated obligations, not cut dollars')
