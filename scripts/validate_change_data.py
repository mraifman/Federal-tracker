#!/usr/bin/env python3
"""Validate the published comparisons and source-file provenance."""
import collections,hashlib,json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
def read(n):return json.loads((ROOT/'data'/n).read_text())
b=read('budget-changes.json');w=read('workforce-changes.json');p=read('program-changes.json')
assert len({r['row'] for r in b['records']})==len(b['records'])==2437
assert b['source_sha256']==hashlib.sha256((ROOT/'data/raw/budauth_fy2027.xlsx').read_bytes()).hexdigest()
for year,total in b['totals'].items():
 assert sum(r['values'][year] for r in b['records'])==total
 assert all(isinstance(r['values'][year],int) for r in b['records'])
assert b['status']=={'2024':'actual','2025':'actual','2026':'estimate','2027':'proposal'}
for level,records in w['records'].items():
 assert len({r['id'] for r in records})==len(records)
 for period,total in w['totals'].items():
  assert sum(r['values'].get(period,0) for r in records)==total,(level,period)
  assert all(isinstance(r['values'][period],int) and r['values'][period]>0 for r in records if period in r['values'])
assert w['totals']['202412']==2312301 and w['totals']['202608']==2024832 and w['totals']['202609']==2017021
assert any(len(r['values'])==1 for r in w['records']['departments'])
assert len(p['records'])==len({r['id'] for r in p['records']})==1667
assert p['exported_on']=='2025-06-05'
assert p['source_sha256']==hashlib.sha256((ROOT/'data/raw/nsf-terminated-awards.csv').read_bytes()).hexdigest()
assert sum(r['obligated'] for r in p['records'])==1345131506
print(f"Validated {len(b['records'])} budget rows, all workforce hierarchy totals, and {len(p['records'])} NSF award records; raw source hashes match.")

h=read('hhs-program-actions.json');x=read('fiscal-execution.json')
assert h['source_sha256']==hashlib.sha256((ROOT/'data/raw/hhs-grants-terminated.pdf').read_bytes()).hexdigest()
assert len(h['records'])==sum(h['page_counts'])==1816
assert len(h['page_counts'])==h['pages']==71
assert len({r['id'] for r in h['records']})==1816
assert len({(r['opdiv'],r['fain']) for r in h['records']})==1572
assert h['duplicate_document_keys']==8
assert all(r['action_date']>='2025-01-20' for r in h['records'])
assert any(r['obligated'] is None for r in h['records'])
assert len(x['records'])==111 and len({r['code'] for r in x['records']})==111 and not x['errors']
matched=0
for agency in x['records']:
 by={y['fiscal_year']:y for y in agency['years']}
 old=next((p['obligated'] for p in by.get(2024,{}).get('agency_obligation_by_period',[]) if p['period']==11),None)
 new=next((p['obligated'] for p in by.get(2026,{}).get('agency_obligation_by_period',[]) if p['period']==11),None)
 if old is not None and new is not None:matched+=1
assert matched==99
assert len(w['periods'])==9
cohort=[r for r in w['records']['departments'] if all(p in r['values'] for p in w['periods']) and r['id']!='DOD']
assert len(cohort)==120
assert sum(r['values']['202412']-r['values']['202609'] for r in cohort)==185274
print('Validated all 111 fiscal-execution responses, 99 matched periods, 1,816 HHS rows with source provenance, and the 120-agency non-defense narrative cohort.')

# Historical topic series: each source row belongs to exactly one official topic.
topics = json.loads((ROOT / 'data/topic-budget.json').read_text())
assert topics['years'] == [str(y) for y in range(2009, 2028)]
assert len(topics['records']) == 3268
assert len({r['id'] for r in topics['records']}) == len(topics['records'])
codes = {t['code'] for t in topics['topics']}
assert len(codes) == 20
for r in topics['records']:
    assert r['topic_code'] in codes and r['classification_status'] == 'official'
    assert set(r['values']) == set(topics['years'])
for year in topics['years']:
    assert sum(r['values'][year] for r in topics['records']) == topics['totals'][year]
national = json.loads((ROOT / 'data/national-employment.json').read_text())
assert national['observations'][0]['date'] == '2009-01-01'
assert national['observations'][-1]['date'] == '2026-10-01'
assert len(national['observations']) == 214
assert next(o['value'] for o in national['observations'] if o['date'] == '2025-01-01') == 3010
restore = json.loads((ROOT / 'data/restoration-evidence.json').read_text())
assert restore['target_date'] == '2025-01-19'
for e in restore['evidence']:
    assert e['funding_target'] is None and e['hiring_target'] is None and e['restoration_cost'] is None
print('Validated FY2009–27 topic totals, 214 monthly national observations, and explicit unknown restoration requirements.')
