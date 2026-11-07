#!/usr/bin/env python3
"""Request all-government transaction records with analysis-relevant columns only."""
import concurrent.futures,json,pathlib,subprocess
CACHE=pathlib.Path('/tmp/federal-atlas-award-analysis');CACHE.mkdir(exist_ok=True)
common=['federal_action_obligation','action_date','awarding_agency_code','awarding_agency_name','awarding_sub_agency_code','awarding_sub_agency_name','funding_agency_code','funding_agency_name','funding_sub_agency_code','funding_sub_agency_name','federal_accounts_funding_this_award','recipient_uei','recipient_name','recipient_country_code']
def request(job):
 year,kind=job;p=CACHE/f'request-{year}-{kind}.json'
 if p.exists():return json.loads(p.read_text())
 columns=common+(['assistance_transaction_unique_key','cfda_number','cfda_title','assistance_type_code','business_types_code','business_types_description','original_loan_subsidy_cost','face_value_of_loan'] if kind=='assistance' else ['contract_transaction_unique_key','product_or_service_code','product_or_service_code_description','naics_code','naics_description','educational_institution','for_profit_organization','nonprofit_organization','other_not_for_profit_organization','private_university_or_college'])
 body={'filters':{'prime_award_types':['02','03','04','05','06','07','08','09','10','11'] if kind=='assistance' else ['A','B','C','D'],'date_type':'action_date','date_range':{'start_date':f'{year-1}-10-01','end_date':f'{year}-09-30'}},'columns':columns,'file_format':'csv'}
 raw=subprocess.check_output(['curl','-fsSL','--retry','1','--max-time','70','-H','Content-Type: application/json','-d',json.dumps(body),'https://api.usaspending.gov/api/v2/bulk_download/awards/']);d=json.loads(raw);d['analysis_year']=year;d['analysis_kind']=kind;d['submitted_request']=body;p.write_text(json.dumps(d,indent=2));print('Requested',year,kind,d.get('file_name'),flush=True);return d
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(request,[(y,k) for y in [2024,2026] for k in ['assistance','contracts']]))
