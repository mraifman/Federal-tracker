#!/usr/bin/env python3
"""Aggregate every transaction in official FY2024/FY2026 full archives.
Raw records stay in /tmp. Public outputs are agency/program/recipient aggregates.
"""
import csv,gzip,hashlib,io,json,sys,pathlib,re,time,zipfile,concurrent.futures,os
from recipient_sectors import assistance_sector, VERSION as SECTOR_VERSION, SOURCE as SECTOR_SOURCE
from program_recipient_rules import apply_rules as apply_program_rules
import pyarrow as pa,pyarrow.compute as pc,pyarrow.csv as pacsv,pyarrow.parquet as pq
import duckdb
ROOT=pathlib.Path(__file__).resolve().parents[1];CACHE=pathlib.Path(os.environ.get('ATLAS_AWARD_CACHE','/tmp/federal-atlas-award-archives'));STAGE=pathlib.Path(os.environ.get('ATLAS_AWARD_STAGE','/tmp/federal-atlas-award-analysis/stage'));STAGE.mkdir(parents=True,exist_ok=True)
OUT_ROOT=pathlib.Path(os.environ.get('ATLAS_AWARD_OUTPUT_ROOT',str(ROOT)))
MANIFEST=json.loads((CACHE/'manifest.json').read_text());SIZES={r['file_name']:r['bytes'] for r in MANIFEST if r.get('bytes') is not None};CHUNK=8*1024*1024
AUTH=json.loads((ROOT/'data/authority-comparison.json').read_text());ACCOUNT_TOPICS={}
for r in AUTH['records']:
 if r['credit_scope'].startswith('NON-'):ACCOUNT_TOPICS.setdefault(r['treasury_account'],set()).add(r['topic_code'])
COMMON=['federal_action_obligation','action_date','awarding_agency_code','awarding_agency_name','awarding_sub_agency_code','awarding_sub_agency_name','funding_agency_code','funding_agency_name','funding_sub_agency_code','funding_sub_agency_name','federal_accounts_funding_this_award','recipient_uei','recipient_name','recipient_country_code']

def ready(r):
 p=CACHE/r['file_name']
 if p.exists():
  if r.get('bytes') is not None:assert p.stat().st_size==r['bytes'],'Archive byte count mismatch'
  return p
 if r['file_name'] not in SIZES:raise RuntimeError('Manifest lacks verified byte counts; use rebuild_award_sectors.py')
 folder=CACHE/(r['file_name']+'.chunks');size=SIZES[r['file_name']];count=(size+CHUNK-1)//CHUNK
 if not all((folder/f'{i:05d}').exists() and (folder/f'{i:05d}').stat().st_size==min(CHUNK,size-i*CHUNK) for i in range(count)):return None
 tmp=p.with_suffix('.analysis-assembly')
 with tmp.open('wb') as out:
  for i in range(count):
   with (folder/f'{i:05d}').open('rb') as inp:
    while block:=inp.read(8*1024*1024):out.write(block)
 assert tmp.stat().st_size==size;tmp.replace(p);print('Complete archive ready for analysis:',p.name,flush=True);return p

def strings(t,k):return pc.fill_null(t[k], '') if k in t.column_names else pa.array(['']*len(t))
def matches(t,k,pattern):return pc.match_substring_regex(pc.utf8_lower(strings(t,k)),pattern)
def true(t,k):return pc.is_in(pc.utf8_lower(strings(t,k)),value_set=pa.array(['t','true','y','yes','1']))
def sector(t,kind):
 n=len(t);out=pa.array(['Other · as reported']*n)
 if kind=='assistance':
  encoded=strings(t,'business_types_code').combine_chunks().dictionary_encode()
  mapped=pa.array([assistance_sector(code) for code in encoded.dictionary.to_pylist()])
  out=pc.take(mapped,encoded.indices)
 else:
  out=pc.if_else(true(t,'for_profit_organization'),'Private sector',out)
  out=pc.if_else(pc.or_(true(t,'nonprofit_organization'),true(t,'other_not_for_profit_organization')),'Nonprofits',out)
  out=pc.if_else(true(t,'foreign_government'),'Foreign governments',out)
  authority=true(t,'us_government_entity')
  for field in ['airport_authority','housing_authorities_public_tribal','port_authority','transit_authority']:authority=pc.or_(authority,true(t,field))
  out=pc.if_else(authority,'Public authorities & other public bodies',out)
  out=pc.if_else(pc.or_(true(t,'us_local_government'),true(t,'school_district_local_government')),'Local governments',out)
  out=pc.if_else(true(t,'us_state_government'),'State governments',out)
  out=pc.if_else(true(t,'us_tribal_government'),'Tribal governments',out)
  out=pc.if_else(true(t,'us_federal_government'),'Federal government',out)
  # Government levels are assigned above from the reported boolean flags; no combined fallback.
  out=pc.if_else(pc.or_(true(t,'educational_institution'),true(t,'private_university_or_college')),'Academia',out)
 return out

def topics(refs):
 encoded=refs.combine_chunks().dictionary_encode();mapped=[];status=[]
 for ref in encoded.dictionary.to_pylist():
  codes=set(re.findall(r'\b\d{3}-\d{4}\b',ref or ''));found=set();unmatched=False
  for code in codes:
   ts=ACCOUNT_TOPICS.get(code,set());found|=ts
   if not ts or ts&{'mixed','unclassified'}:unmatched=True
  if len(found)==1 and not unmatched: mapped.append(next(iter(found)));status.append('Unique official account-purpose match')
  else:mapped.append('unallocated');status.append('Missing or mixed award-wide account references; no dollar shares inferred')
 return pc.take(pa.array(mapped),encoded.indices),pc.take(pa.array(status),encoded.indices)

def parse_archive(r):
 year=r['fiscal_year'];kind=r['type'];p=ready(r)
 if not p:return None
 receipt=STAGE/(p.name+'.receipt.json')
 if receipt.exists():
  saved=json.loads(receipt.read_text())
  if saved.get('recipient_sector_version')==SECTOR_VERSION and len(list(STAGE.glob(f'{year}-{kind}-*.parquet')))==saved['stage_chunks']:return saved
  for stale in STAGE.glob(f'{year}-{kind}-*.parquet'):stale.unlink()
 keys=COMMON+(['assistance_transaction_unique_key','cfda_number','cfda_title','assistance_type_code','business_types_code','business_types_description','original_loan_subsidy_cost','face_value_of_loan','generated_pragmatic_obligations'] if kind=='assistance' else ['contract_transaction_unique_key','product_or_service_code','product_or_service_code_description','naics_code','naics_description','educational_institution','for_profit_organization','nonprofit_organization','other_not_for_profit_organization','private_university_or_college','award_type_code','us_federal_government','us_state_government','us_local_government','us_tribal_government','foreign_government','us_government_entity','school_district_local_government','airport_authority','housing_authorities_public_tribal','port_authority','transit_authority'])
 rows=0;chunks=0;missing_amounts=0;source_counts={}
 with zipfile.ZipFile(p) as z:
  names=[n for n in z.namelist() if n.lower().endswith('.csv')];assert names
  for name in names:
   reader=pacsv.open_csv(z.open(name),read_options=pacsv.ReadOptions(block_size=16*1024*1024,use_threads=False),parse_options=pacsv.ParseOptions(newlines_in_values=True),convert_options=pacsv.ConvertOptions(include_columns=keys,column_types={k:pa.string() for k in keys},strings_can_be_null=True))
   file_rows=0
   for batch in reader:
    t=pa.Table.from_batches([batch]);n=len(t);file_rows+=n;rows+=n;sec=sector(t,kind);raw_amount=pc.cast(t['federal_action_obligation'],pa.float64())
    if kind=='assistance':
     code=pc.utf8_slice_codeunits(strings(t,'assistance_type_code'),-2);loan=pc.is_in(code,value_set=pa.array(['07','08']));amount=pc.cast(t['generated_pragmatic_obligations'],pa.float64());face=pc.if_else(loan,pc.cast(t['face_value_of_loan'],pa.float64()),pa.scalar(None,pa.float64()));grant=pc.is_in(code,value_set=pa.array(['02','03','04','05']));award_kind=pc.if_else(loan,'Loan subsidy cost',pc.if_else(grant,'Grants / cooperative agreements','Other assistance'));program_code=strings(t,'cfda_number');program_name=strings(t,'cfda_title');txn=strings(t,'assistance_transaction_unique_key')
    else:
     amount=raw_amount;face=pa.nulls(n,type=pa.float64());award_kind=pa.array(['Contracts']*n);program_code=strings(t,'product_or_service_code');program_name=strings(t,'product_or_service_code_description');txn=strings(t,'contract_transaction_unique_key')
    topic,classification=topics(strings(t,'federal_accounts_funding_this_award'));recipient_name=pc.if_else(pc.equal(sec,'Individuals'),'Individuals — names not published',strings(t,'recipient_name'));recipient_id=pc.if_else(pc.equal(sec,'Individuals'),'INDIVIDUALS',strings(t,'recipient_uei'))
    env=pc.match_substring_regex(pc.utf8_lower(program_name),r'climate|environment|clean energy|renewable|energy efficien|ecosystem|atmospher|ocean|conservation|carbon|weather')
    old=pa.array(['Other · as reported']*n)
    if kind=='assistance':
     for label,pattern in [('Private sector',r'for.profit|small business|sole propriet|partnership|corporation'),('Individuals',r'individual'),('Government / public bodies',r'government|county|city|township|district|public housing|tribal'),('Nonprofits',r'non.?profit|not.for.profit'),('Academia',r'higher education|universit|college')]:old=pc.if_else(matches(t,'business_types_description',pattern),label,old)
    else:old=sec
    cols={'reported_business_types_code':strings(t,'business_types_code'),'reported_business_types_description':strings(t,'business_types_description'),'prior_keyword_sector':old,'year':pa.array([year]*n,type=pa.int16()),'source_kind':pa.array([kind]*n),'transaction_key':txn,'amount':amount,'loan_face_value':face,'award_kind':award_kind,'sector':sec,'topic_code':topic,'classification':classification,'environment_lens':env,'program_code':program_code,'program_name':program_name,'recipient_id':recipient_id,'recipient_name':recipient_name}
    for field in ['awarding_agency_code','awarding_agency_name','awarding_sub_agency_code','awarding_sub_agency_name','funding_agency_code','funding_agency_name','funding_sub_agency_code','funding_sub_agency_name']:cols[field]=strings(t,field)
    table=pa.table(cols);out=STAGE/f'{year}-{kind}-{chunks:05d}.parquet';pq.write_table(table,out,compression='zstd');chunks+=1;missing_amounts+=pc.sum(pc.cast(pc.is_null(amount),pa.int64())).as_py()
    if chunks%20==0:print('Parsed',year,kind,format(rows,','),'transactions',flush=True)
   source_counts[name]=file_rows
 h=hashlib.sha256()
 with p.open('rb') as f:
  while block:=f.read(8*1024*1024):h.update(block)
 result={**r,'recipient_sector_version':SECTOR_VERSION,'sha256':h.hexdigest(),'bytes':p.stat().st_size,'transaction_rows':rows,'missing_amount_rows':missing_amounts,'csv_rows':source_counts,'stage_chunks':chunks};receipt.write_text(json.dumps(result,indent=2));print('Completed parsing',year,kind,format(rows,','),'transactions',flush=True);return result

def records(query,con):return [dict(zip([c[0] for c in cur.description],row)) for cur in [con.execute(query)] for row in cur.fetchall()]
def export_all(receipts):
 out=OUT_ROOT/'data/outbound';out.mkdir(parents=True,exist_ok=True);con=duckdb.connect(str(STAGE/'analysis.duckdb'));con.execute("SET memory_limit='2GB'");con.execute('SET threads=4');con.execute("SET temp_directory='"+str(STAGE.parent/'spill')+"'")
 con.execute("CREATE OR REPLACE VIEW raw AS SELECT * FROM read_parquet('"+str(STAGE/'[0-9]*.parquet')+"')")
 duplicate=records('SELECT year,source_kind,count(*) AS rows,count(DISTINCT transaction_key) AS unique_keys FROM raw GROUP BY ALL',con)
 assert {(r['year'],r['source_kind']):r['rows'] for r in duplicate}=={(r['fiscal_year'],r['type']):r['transaction_rows'] for r in receipts},'Incomplete normalized archive stages'
 conflicts=records('SELECT year,source_kind,transaction_key,count(DISTINCT amount) n FROM raw GROUP BY ALL HAVING count(*)>1 AND count(DISTINCT amount)>1 LIMIT 10',con);assert not conflicts,('Conflicting duplicate financial transactions',conflicts)
 print('Transaction identifiers checked; materializing deduplicated records.',flush=True)
 if con.execute("SELECT count(*) FROM information_schema.views WHERE table_name='tx'").fetchone()[0]:con.execute('DROP VIEW tx')
 con.execute('CREATE OR REPLACE TABLE tx AS SELECT * FROM raw QUALIFY row_number() OVER(PARTITION BY year,source_kind,transaction_key ORDER BY transaction_key)=1')
 # Conservative identity evidence: an unclassified record inherits a sector only when the same UEI reports exactly one sector elsewhere in these archives.
 con.execute("CREATE OR REPLACE TABLE recipient_identity AS SELECT recipient_id,min(sector) sector FROM tx WHERE recipient_id NOT IN ('','INDIVIDUALS') AND sector NOT IN ('Other · as reported','Individuals') GROUP BY recipient_id HAVING count(DISTINCT sector)=1")
 inherited=con.execute("SELECT count(*),coalesce(sum(amount),0) FROM tx t JOIN recipient_identity i USING(recipient_id) WHERE t.sector='Other · as reported'").fetchone()
 con.execute("UPDATE tx SET sector=i.sector FROM recipient_identity i WHERE tx.recipient_id=i.recipient_id AND tx.sector='Other · as reported'")
 print('Inherited sectors for',format(inherited[0],','),'unclassified transactions from consistent same-UEI records.',flush=True)
 program_rules=apply_program_rules(con);print('Program-eligibility rules classified',format(sum(r['transactions'] for r in program_rules['applied']),','),'transactions.',flush=True)
 summary=records('SELECT year,award_kind,count(*) transaction_count,count(amount) known_amount_count,sum(amount) amount,sum(loan_face_value) loan_face_value FROM tx GROUP BY ALL',con)
 audit=records('SELECT year,source_kind,reported_business_types_code,reported_business_types_description,prior_keyword_sector,sector,count(*) transaction_count,sum(amount) amount FROM tx GROUP BY ALL',con)
 (OUT_ROOT/'data').mkdir(parents=True,exist_ok=True)
 reviewed=records("SELECT year,transaction_key,program_code,program_name,recipient_id,recipient_name,reported_business_types_code,reported_business_types_description,sector,amount FROM tx WHERE source_kind='assistance' AND program_code IN ('66.957','66.960') ORDER BY year,program_code,recipient_id,transaction_key",con)
 (OUT_ROOT/'data/recipient-sector-audit.json').write_text(json.dumps({'version':SECTOR_VERSION,'inherited_unknown':{'transactions':inherited[0],'amount':inherited[1],'rule':'An unclassified record inherits a sector only when the same UEI reports exactly one sector elsewhere in these archives; conflicting or absent evidence stays unclassified.'},'program_rules':program_rules,'code_source':SECTOR_SOURCE,'scope':'Both full fiscal years; one current official archive vintage for assistance and contracts. Changes compare the old keyword rule with explicit codes on the same transactions, not different archive vintages.','sources':receipts,'reviewed_examples':reviewed,'rows':audit},separators=(',',':'))+'\n')
 sector_rows=records('SELECT year,topic_code,sector,award_kind,environment_lens,sum(amount) amount,count(*) transaction_count,count(amount) known_amount_count FROM tx GROUP BY ALL',con)
 # Expand separate funding/issuing views; these are never added together.
 con.execute("CREATE OR REPLACE VIEW units AS SELECT *, 'funding' basis,coalesce(nullif(funding_agency_code,''),'unreported') unit_code,coalesce(nullif(funding_agency_name,''),'Funding agency unreported') unit_name FROM tx UNION ALL SELECT *, 'awarding' basis,coalesce(nullif(awarding_agency_code,''),'unreported') unit_code,coalesce(nullif(awarding_agency_name,''),'Awarding agency unreported') unit_name FROM tx UNION ALL SELECT *, 'awarding' basis,'NIH' unit_code,'National Institutes of Health' unit_name FROM tx WHERE lower(awarding_sub_agency_name) LIKE '%national institutes of health%' UNION ALL SELECT *, 'funding' basis,'NIH' unit_code,'National Institutes of Health' unit_name FROM tx WHERE lower(funding_sub_agency_name) LIKE '%national institutes of health%' UNION ALL SELECT *, 'funding' basis,'ALL' unit_code,'All government external awards' unit_name FROM tx UNION ALL SELECT *, 'awarding' basis,'ALL' unit_code,'All government external awards' unit_name FROM tx")
 print('Building reconciled sector/program/recipient totals.',flush=True)
 # Aggregate once, preserving every reported recipient for compact exports.
 con.execute("CREATE OR REPLACE TABLE sector_totals AS SELECT unit_code,basis,year,sector,award_kind,topic_code,environment_lens,sum(amount) amount,count(*) transaction_count,count(amount) known_amount_count FROM units GROUP BY ALL")
 print('Sector totals complete.',flush=True)
 con.execute("CREATE OR REPLACE TABLE program_totals AS SELECT unit_code,basis,year,program_code,program_name,topic_code,award_kind,sector,environment_lens,sum(amount) amount,count(*) transaction_count,count(amount) known_amount_count FROM units GROUP BY ALL")
 print('Program totals complete.',flush=True)
 con.execute("CREATE OR REPLACE TABLE recipient_totals AS SELECT unit_code,basis,year,program_code,program_name,recipient_id,recipient_name,sector,topic_code,award_kind,environment_lens,sum(amount) amount,count(*) transaction_count,count(amount) known_amount_count FROM units GROUP BY ALL")
 print('Recipient totals complete.',flush=True)
 con.execute("CREATE OR REPLACE TABLE recipient_ranked AS SELECT *,dense_rank() OVER(PARTITION BY unit_code,basis,year,program_code,award_kind ORDER BY abs(amount) DESC,recipient_id) recipient_rank FROM recipient_totals")
 export_files(con,receipts,duplicate,summary,sector_rows)

def export_files(con,receipts,duplicate,summary,sector_rows,retrieved_on=None):
 out=OUT_ROOT/'data/outbound';out.mkdir(parents=True,exist_ok=True)
 # Publish every reported organizational recipient; sector shards bound browser downloads.
 units=records('SELECT unit_code,arg_max(unit_name,year) unit_name FROM units GROUP BY unit_code ORDER BY unit_name',con);index_units=[]
 for u in units:
  code=u['unit_code'];assert re.fullmatch(r'[A-Za-z0-9_-]+',code),code
  literal="'"+code.replace("'","''")+"'";where=' WHERE unit_code='+literal
  sectors=records('SELECT * EXCLUDE(unit_code) FROM sector_totals'+where,con)
  programs=records('SELECT * EXCLUDE(unit_code) FROM program_totals'+where,con)
  shards=[]
  for role,sector_name in con.execute('SELECT DISTINCT basis,sector FROM recipient_totals'+where+' ORDER BY basis,sector').fetchall():
   suffix=role+'-'+re.sub('[^a-z0-9]+','-',sector_name.lower()).strip('-')
   filename=code+'-recipients-'+suffix+'.json.gz'
   query="SELECT year,program_code,program_name,recipient_id,recipient_name,topic_code,award_kind,environment_lens,amount,transaction_count,known_amount_count FROM recipient_totals"+where+" AND basis=? AND sector=? ORDER BY year,program_code,recipient_id"
   raw=con.execute(query,[role,sector_name]).fetchall();program_map={};recipient_map={};compact=[]
   for year,pc,pn,rid,rn,tc,kind,env,amount,count,known in raw:
    program_map.setdefault((pc,pn),len(program_map));recipient_map.setdefault((rid,rn),len(recipient_map))
    compact.append([year,program_map[pc,pn],recipient_map[rid,rn],tc,kind,env,amount,count,known])
   payload={'format':'recipient-rows-v1','basis':role,'sector':sector_name,'programs':list(program_map),'recipients':list(recipient_map),'rows':compact}
   (out/filename).write_bytes(gzip.compress((json.dumps(payload,separators=(',',':'),allow_nan=False)+'\n').encode(),mtime=0))
   shards.append({'basis':role,'sector':sector_name,'file':'data/outbound/'+filename,'rows':len(compact)})
   del raw,compact,payload
  (out/(code+'-recipients.json.gz')).write_bytes(gzip.compress((json.dumps({'format':'recipient-shards-v1','shards':shards},separators=(',',':'))+'\n').encode(),mtime=0))
  payload={'code':code,'name':u['unit_name'],'years':[2024,2026],'sectors':sectors,'programs':programs,'recipients_file':'data/outbound/'+code+'-recipients.json.gz','recipient_detail':'All reported organizational recipients are retained separately for both years, by sector and agency role. Individual recipients remain privacy-grouped; source-unreported identities are not inferred.'};(out/(code+'.json.gz')).write_bytes(gzip.compress((json.dumps(payload,separators=(',',':'),allow_nan=False)+'\n').encode(),mtime=0));index_units.append({'code':code,'name':u['unit_name'],'file':'data/outbound/'+code+'.json.gz'});print('Exported recipient/program allocations',code,flush=True)
 excluded=json.loads((ROOT/'data/mandatory-benefit-programs.json').read_text())['programs']
 exclusions=','.join("'"+x.replace("'","''")+"'" for x in excluded)
 agency_rows=records("SELECT unit_code agency_code,basis,year,sector,award_kind,topic_code,environment_lens,sum(amount) amount,sum(transaction_count) transaction_count,sum(known_amount_count) known_amount_count FROM program_totals WHERE unit_code NOT IN ('ALL','NIH') AND program_code NOT IN ("+exclusions+") GROUP BY ALL",con)
 names={u['code']:u['name'] for u in index_units}
 for row in agency_rows:row['agency_name']=names[row['agency_code']]
 (out/'agency-changes.json.gz').write_bytes(gzip.compress((json.dumps(agency_rows,separators=(',',':'))+'\n').encode(),mtime=0))
 index={'status':'complete','retrieved_on':retrieved_on or time.strftime('%Y-%m-%d',time.gmtime()),'recipient_sector_version':SECTOR_VERSION,'recipient_sector_code_source':SECTOR_SOURCE,'sector_audit':'data/recipient-sector-audit.json','program_recipient_rules':'data/program-recipient-rules.json','source_vintage':'Official full archives updated '+', '.join(sorted({r['updated_date'] for r in receipts})),'years':[2024,2026],'period':'Full fiscal years, action-date transactions','definition':'Net federal award obligations; for loans, original transaction subsidy cost is used and loan face value remains separate. Never sums repeated lifetime award totals. Funding and awarding agency views are separate and must not be added together.','sector_basis':'Assistance uses explicit reported FABS business-type codes, never words in their descriptions. H/O/S/T/U/V and legacy 06/20 identify higher education; M/N/12 identify nonprofits. Multiple flags use disclosed precedence: individuals (privacy), higher education, nonprofits, public bodies, private sector. Unmapped codes and the federal "Other" code are reported as Other · as reported, never guessed. Contract groups retain reported boolean classifications. These are prime-recipient sectors, not program purpose or ultimate beneficiaries. See recipient-sector-audit.json and the pinned federal code definitions.','topic_basis':'Unique official SF133 account-purpose match using award-wide federal-account references. Missing or multi-purpose references remain unallocated; no transaction-level dollar shares are invented. Program-title environmental lens is an overlapping, explicitly rule-based view.','sources':receipts,'deduplication':duplicate,'summary':summary,'topic_sectors':sector_rows,'units':index_units,'limitations':['Award obligations are commitments, not cash disbursements or enacted appropriations.','Archived FY2026 records may be revised in later releases; this is the specified archive vintage, not a live ledger.','Program and recipient names can change; identifiers and source titles are retained.','Recipient sectors and topics describe reported records, not a causal finding about administration decisions.','Award-wide federal-account references may span multiple purposes or years; unresolved allocations are retained separately.']}
 (OUT_ROOT/'data/outbound-awards.json').write_text(json.dumps(index,separators=(',',':'),allow_nan=False)+'\n');con.close();print('Published government-wide external resource allocations.',flush=True)

def main():
 pending=MANIFEST[:];receipts=[]
 while pending:
  available=[r for r in pending if ready(r)]
  if not available:print('Waiting for remaining validated archive ranges…',flush=True);time.sleep(15);continue
  for r in available:
   result=parse_archive(r);receipts.append(result);pending.remove(r)
 export_all(receipts)
if __name__=='__main__':
 if '--publish-only' in sys.argv:
  prior=json.loads((ROOT/'data/outbound-awards.json').read_text());con=duckdb.connect(str(STAGE/'analysis.duckdb'));con.execute("SET memory_limit='2GB'");con.execute('SET threads=4');export_files(con,prior['sources'],prior['deduplication'],prior['summary'],prior['topic_sectors'],retrieved_on=prior['retrieved_on'])
 else:main()
