#!/usr/bin/env python3
"""Reconciliation and provenance checks for the active three-view comparison."""
import json,math,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
def read(name):return json.loads((ROOT/'data'/f'{name}.json').read_text())
a=read('authority-comparison');s=read('spending-comparison');w=read('workforce-changes');links=read('spending-workforce-crosswalk')
assert len(a['sources'])==58 and len(a['records'])==2104
assert {src['year'] for src in a['sources']}=={2024,2026}
assert len({r['id'] for r in a['records']})==len(a['records'])
for r in a['records']:
 assert r['topic_code'] and r['classification_basis']
 if r['topic_code']=='mixed':assert len(r['candidate_topics'])>1 and r['classification_status']=='mixed_account_unallocated'
 for year,values in r['years'].items():
  source=a['sources'][values['source_index']]
  assert str(source['year'])==year and len(source['sha256'])==64
  assert values['source_rows'] and all(x['row']>=2 for x in values['source_rows'])
  assert all(isinstance(v,(int,float)) and math.isfinite(v) for v in values['metrics'].values())
discretionary_lines={'4070':'discretionary_net_authority','4000':'discretionary_gross_authority','1160':'discretionary_appropriations','4080':'discretionary_net_outlays'}
assert a.get('discretionary_definition')
for r in a['records']:
 for values in r['years'].values():
  rows=values.get('discretionary_source_rows',[])
  assert all(x['row']>=2 and x['line'] in discretionary_lines for x in rows)
  present={x['line'] for x in rows}
  for line,metric in discretionary_lines.items():
   assert (metric in values['metrics'])==(line in present), (r['id'],metric)
assert len({r['agency_code'] for r in a['records']})==123
nih=[r for r in a['records'] if r['credit_scope'].startswith('NON-') and 'national institutes of health' in r['bureau'].lower()]
assert len(nih)==33
for year,expected in [('2024',47895020924.62),('2026',47818560823.33)]:
 assert abs(sum(r['years'].get(year,{}).get('metrics',{}).get('net_authority',0) for r in nih)-expected)<1
assert len(s['records'])==110 and len(s['errors'])==1
for r in s['records']:
 for year,views in r['years'].items():
  for name,d in views.items():
   assert d['end_date'].startswith(year+'-08-31')
   assert d['source']['request']['filters']['period']=='11'
   assert len(d['source']['sha256'])==64
   if d['total'] is not None:assert abs(sum(v['amount'] for v in d['records'])-d['total'])<max(2,abs(d['total'])*1e-8)
for year,expected in [('2024',48439857981.25),('2026',46520123106.79)]:
 assert abs(sum((r['years'][year]['total'] or 0) for r in s['nih']['accounts'])-expected)<1
 for r in s['nih']['accounts']:
  d=r['years'][year];assert d['end_date'].startswith(year+'-08-31')
  assert d['total'] is None or abs(sum(x['obligations'] for x in d['records'])-d['total'])<2
nih_staff=next(r for r in w['records']['subagencies'] if r['id']=='HE|HE38')
assert nih_staff['values']['202609']-nih_staff['values']['202412']==-5052
opm_ids={r['id'] for r in w['records']['departments']};authority_ids={r['id'] for r in a['records']}
assert all(x in opm_ids for x in links['links'].values())
assert all(i in authority_ids for ids in links['authority_records'].values() for i in ids)
print('Validated 58 SF133 workbooks, 2,104 accounts across 123 categories, 110 paired agency spending responses, 34 NIH accounts, source dates and crosswalks.')
