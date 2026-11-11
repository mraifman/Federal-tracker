"""Assign a recipient class from program eligibility to records the agency coded as Other.

Rules live in data/program-recipient-rules.json. A rule applies only to assistance
records whose sector is still 'Unknown / unclassified' after explicit FABS codes and
same-UEI evidence; it never overrides a reported recipient type and never reads names.
"""
import json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
RULES_PATH=ROOT/'data/program-recipient-rules.json'
def load_rules():
    data=json.loads(RULES_PATH.read_text())
    codes=[r['program_code'] for r in data['rules']]
    assert len(codes)==len(set(codes)),'duplicate program rule'
    return data
def apply_rules(con):
    data=load_rules();applied=[]
    for rule in data['rules']:
        n,amt=con.execute("SELECT count(*),coalesce(sum(amount),0) FROM tx WHERE source_kind='assistance' AND sector='Unknown / unclassified' AND program_code=?",[rule['program_code']]).fetchone()
        if n:con.execute("UPDATE tx SET sector=? WHERE source_kind='assistance' AND sector='Unknown / unclassified' AND program_code=?",[rule['sector'],rule['program_code']])
        applied.append({'program_code':rule['program_code'],'program_name':rule['program_name'],'sector':rule['sector'],'eligibility':rule['eligibility'],'transactions':n,'amount':amt})
    return {'version':data['version'],'rules_file':'data/program-recipient-rules.json','basis':data['definition'],'applied':applied}
