#!/usr/bin/env python3
"""Apply program-eligibility rules to an existing analysis stage and re-export, without re-downloading archives."""
import json,os,pathlib,re,sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
STAGE=pathlib.Path(os.environ['ATLAS_AWARD_STAGE']);OUT=pathlib.Path(os.environ['ATLAS_AWARD_OUTPUT_ROOT'])
import duckdb,analyze_external_awards as a
from program_recipient_rules import apply_rules
ROOT=a.ROOT;prior=json.loads((ROOT/'data/outbound-awards.json').read_text());prior_audit=json.loads((ROOT/'data/recipient-sector-audit.json').read_text())
con=duckdb.connect(str(STAGE/'analysis.duckdb'));con.execute("SET memory_limit='2GB'");con.execute('SET threads=4');con.execute("SET temp_directory='"+str(STAGE.parent/'spill')+"'")
if not con.execute("SELECT count(*) FROM information_schema.views WHERE table_name='units'").fetchone()[0]:
    src=(ROOT/'scripts/analyze_external_awards.py').read_text();m=re.search(r'con\.execute\("(CREATE OR REPLACE VIEW units AS .*?)"\)',src);con.execute(m.group(1))
con.execute("UPDATE tx SET sector='Other · as reported' WHERE sector='Unknown / unclassified'")
program_rules=apply_rules(con)
prev={r['program_code']:r for r in (prior_audit.get('program_rules') or {}).get('applied',[])}
for r in program_rules['applied']:
    if r['program_code'] in prev:r['transactions']+=prev[r['program_code']]['transactions'];r['amount']+=prev[r['program_code']]['amount']
print('Program-eligibility rules classified',format(sum(r['transactions'] for r in program_rules['applied']),','),'transactions.',flush=True)
audit=a.records('SELECT year,source_kind,reported_business_types_code,reported_business_types_description,prior_keyword_sector,sector,count(*) transaction_count,sum(amount) amount FROM tx GROUP BY ALL',con)
reviewed=a.records("SELECT year,transaction_key,program_code,program_name,recipient_id,recipient_name,reported_business_types_code,reported_business_types_description,sector,amount FROM tx WHERE source_kind='assistance' AND program_code IN ('66.957','66.960') ORDER BY year,program_code,recipient_id,transaction_key",con)
(OUT/'data').mkdir(parents=True,exist_ok=True)
(OUT/'data/recipient-sector-audit.json').write_text(json.dumps({'version':a.SECTOR_VERSION,'inherited_unknown':prior_audit.get('inherited_unknown'),'program_rules':program_rules,'code_source':a.SECTOR_SOURCE,'scope':prior_audit.get('scope'),'sources':prior['sources'],'reviewed_examples':reviewed,'rows':audit},separators=(',',':'))+'\n')
sector_rows=a.records('SELECT year,topic_code,sector,award_kind,environment_lens,sum(amount) amount,count(*) transaction_count,count(amount) known_amount_count FROM tx GROUP BY ALL',con)
for name,group in [('sector','sector,award_kind,topic_code,environment_lens'),('program','program_code,program_name,topic_code,award_kind,sector,environment_lens'),('recipient','program_code,program_name,recipient_id,recipient_name,sector,topic_code,award_kind,environment_lens')]:
    con.execute(f'CREATE OR REPLACE TABLE {name}_totals AS SELECT unit_code,basis,year,{group},sum(amount) amount,count(*) transaction_count,count(amount) known_amount_count FROM units GROUP BY ALL');print(name,'totals rebuilt',flush=True)
con.execute("CREATE OR REPLACE TABLE recipient_ranked AS SELECT *,dense_rank() OVER(PARTITION BY unit_code,basis,year,program_code,award_kind ORDER BY abs(amount) DESC,recipient_id) recipient_rank FROM recipient_totals")
a.export_files(con,prior['sources'],prior['deduplication'],prior['summary'],sector_rows,retrieved_on=prior['retrieved_on'])
