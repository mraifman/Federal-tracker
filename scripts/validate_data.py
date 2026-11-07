#!/usr/bin/env python3
"""Fail deployment on malformed, mismatched, or insufficient federal observations."""
import json
from refresh_awards import ROOT, observation
from refresh_entities import validate as validate_entities


def main():
    inventory = json.loads((ROOT / 'data/agencies.json').read_text())
    data = json.loads((ROOT / 'data/agency-awards.json').read_text())
    codes = {a['code'] for a in inventory['agencies']}
    assert len(codes) == inventory['count'] >= 10
    assert {a['code'] for a in data['agencies']} == codes
    assert len(data['agencies']) == len(codes)
    count = 0
    for agency in data['agencies']:
        for year, row in agency['years'].items():
            observation({'toptier_code': agency['code'], 'fiscal_year': int(year),
                         'obligations': row['obligations'], 'transaction_count': row['transactions']}, agency['code'], int(year))
            assert row['source'].startswith('https://api.usaspending.gov/api/v2/agency/' + agency['code'] + '/awards/?')
            assert 'agency_type=funding' in row['source']
            count += 1
    assert count == data['verified_observations']
    assert count + len(data['errors']) == data['expected_observations'] == len(codes) * len(data['fiscal_years'])
    assert count >= data['expected_observations'] * .95
    validate_entities(json.loads((ROOT / 'data/federal-entities.json').read_text()))
    print(f'Validated {len(codes)} agencies and {count} federal agency-year observations')

if __name__ == '__main__':
    main()
