"""Recipient groups from explicit USAspending FABS codes, never description keywords.

Federal code definitions: compile_fabs_business_categories in Treasury's
create_business_categories_functions.sql (pinned source in data/raw).
Concatenated modern codes and legacy two-digit codes are both supported.
"""
import re
VERSION = 'fabs-explicit-codes-v2'
SOURCE = 'https://github.com/fedspendingtransparency/usaspending-api/blob/1fcb25ff13af5c1600db95989f92d57c3b7014a1/usaspending_api/broker/management/sql/create_business_categories_functions.sql'
GROUPS = {
 'Individuals': {'P','21'},
 'Academia': {'H','O','S','T','U','V','06','20'},
 'Nonprofits': {'M','N','12'},
 'Government / public bodies': set('ABCDEFGIJKL') | {'00','01','02','04','05','11'},
 'Private sector': {'Q','R','22','23'},
}
# Explicit higher-education codes override nonprofit/public-body flags.
# Any individual flag takes precedence to prevent publication of personal names.
PRIORITY = ['Individuals','Academia','Nonprofits','Government / public bodies','Private sector']

def codes(value):
    value = str(value or '').strip().upper()
    result = set()
    for part in re.split(r'[\s,;|]+', value):
        if re.fullmatch(r'[A-X]+', part):
            result.update(part)
        elif re.fullmatch(r'(?:\d{2})+', part):
            result.update(part[i:i+2] for i in range(0,len(part),2))
    return result

def assistance_sector(value):
    reported = codes(value)
    return next((group for group in PRIORITY if reported & GROUPS[group]), 'Unknown / unclassified')
