#!/usr/bin/env python3
"""Actual occupational-series breakdowns for every retained department and subagency."""
import json,pathlib,pyarrow as pa,pyarrow.compute as pc,pyarrow.parquet as pq
ROOT=pathlib.Path(__file__).resolve().parents[1]
def main():
 source=json.loads((ROOT/'data/workforce-changes.json').read_text());records={}
 for period in source['periods']:
  p=pathlib.Path(f'/tmp/opm-employment-{period}.parquet');cols=['department_code','agency_subelement_code','occupational_series_code','occupational_series','count'];t=pq.read_table(p,columns=cols);t=t.set_column(t.schema.get_field_index('count'),'count',pc.cast(t['count'],pa.int64()))
  for keys,kind in [(['department_code','occupational_series_code','occupational_series'],'department'),(['department_code','agency_subelement_code','occupational_series_code','occupational_series'],'subagency')]:
   grouped=t.group_by(keys).aggregate([('count','sum')]).to_pylist()
   for r in grouped:
    parent=r['department_code'] if kind=='department' else r['department_code']+'|'+r['agency_subelement_code'];code=r['occupational_series_code'] or 'UNKNOWN';key=parent+'|role|'+code
    if key not in records:records[key]={'id':key,'parent':parent,'level':'occupation','code':code,'name':r['occupational_series'] or 'Unknown occupational series','values':{}}
    records[key]['values'][period]=records[key]['values'].get(period,0)+r['count_sum']
  print('Aggregated occupational breakdowns',period,flush=True)
 out={'retrieved_on':'2026-11-07','definition':'Actual OPM employment counts by occupational series within each department/subagency. These are roles, not organizational offices. Missing periods remain missing. Source and coverage match workforce-changes.json.','periods':source['periods'],'sources':source['sources'],'records':list(records.values())}
 (ROOT/'data/workforce-roles.json').write_text(json.dumps(out,separators=(',',':'),allow_nan=False)+'\n');print('Published',len(records),'role groups',flush=True)
if __name__=='__main__':main()
