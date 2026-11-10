#!/usr/bin/env python3
"""Check organizational rollups and external award conservation across views."""
import collections,gzip,json,math,pathlib,os
ROOT=pathlib.Path(__file__).resolve().parents[1]
def read(p):
 path=(pathlib.Path(os.environ.get('ATLAS_AWARD_OUTPUT_ROOT',str(ROOT))) if p.startswith('data/outbound') or p=='data/recipient-sector-audit.json' else ROOT)/p
 return json.loads(gzip.decompress(path.read_bytes()) if path.suffix=='.gz' else path.read_bytes())
w=read('data/workforce-changes.json');roles=read('data/workforce-roles.json')['records'];parents={r['id']:r for k in ['departments','subagencies'] for r in w['records'][k]};totals=collections.defaultdict(lambda:collections.Counter())
for r in roles:
 assert r['parent'] in parents
 for period,n in r['values'].items():totals[r['parent']][period]+=n
for parent,periods in totals.items():
 for period,n in periods.items():assert n==parents[parent]['values'][period],(parent,period,n)
print('Validated all occupational-series counts against their source organizational totals.')
p=ROOT/'data/outbound-awards.json'
if not p.exists():raise SystemExit('Complete external award export is required.')
i=read('data/outbound-awards.json');assert i.get('recipient_sector_version')=='fabs-explicit-codes-v2', 'Recipient sectors require explicit-code rebuild'
audit=read(i['sector_audit']);assert audit['version']==i['recipient_sector_version']
audit_counts=collections.Counter()
for row in audit['rows']:
 audit_counts[(row['year'],row['source_kind'])]+=row['transaction_count']
 if row['source_kind']=='assistance' and row['reported_business_types_code'] in ['M','N','12','MX','NX']:assert row['sector']=='Nonprofits'
assert dict(audit_counts)=={(r['year'],r['source_kind']):r['unique_keys'] for r in i['deduplication']},'Sector audit must cover every unique source transaction'
assert i['status']=='complete' and len(i['sources'])==4
assert {s['fiscal_year'] for s in i['sources']}=={2024,2026}
assert all(len(s['sha256'])==64 and sum(s['csv_rows'].values())==s['transaction_rows'] for s in i['sources'])
def agg(rows):
 d=collections.defaultdict(float)
 for r in rows:
  assert r['known_amount_count']<=r['transaction_count'];assert r['amount'] is None or math.isfinite(r['amount'])
  d[(r['basis'],r['year'],r['sector'],r['award_kind'],r['topic_code'],r['environment_lens'])]+=r['amount'] or 0
 return d
for u in i['units']:
 d=read(u['file']);s=agg(d['sectors']);p=agg(d['programs']);recipients=read(d['recipients_file']);r=agg(recipients)
 for row in recipients:
  if row['sector']=='Individuals':assert row['recipient_id'] in ['INDIVIDUALS','OTHER_RECIPIENTS']
 assert s.keys()==p.keys()==r.keys(),u['code']
 for k,n in s.items():
  assert abs(n-p[k])<max(1,abs(n)*1e-10),(u['code'],k,'program reconciliation')
  assert abs(n-r[k])<max(1,abs(n)*1e-10),(u['code'],k,'recipient reconciliation')
for path in (ROOT/'data/outbound').glob('*.json.gz'):assert path.stat().st_size<95_000_000,(path,'GitHub file limit')
print(f"Validated four full award archives and sector/program/recipient conservation across {len(i['units'])} agency views.")
