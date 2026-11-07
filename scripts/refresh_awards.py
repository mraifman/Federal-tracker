#!/usr/bin/env python3
"""Retrieve verified funding-agency award obligations; never infer missing values."""
from concurrent.futures import ThreadPoolExecutor, as_completed
import datetime as dt
import json
import math
import pathlib
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = 'https://api.usaspending.gov'


def get(path, params=None):
    url = BASE + path
    if params:
        url += '?' + urllib.parse.urlencode(params)
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'FederalAtlasResearch/1.0', 'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=20) as res:
                return json.load(res)
        except (OSError, ValueError) as exc:
            if isinstance(exc, urllib.error.HTTPError) and 400 <= exc.code < 500 and exc.code != 429:
                raise
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


def observation(payload, code, year):
    if str(payload.get('toptier_code')) != code or payload.get('fiscal_year') != year:
        raise ValueError('Response agency/year does not match request')
    value = payload.get('obligations')
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError('Missing or nonfinite obligations')
    count = payload.get('transaction_count')
    if isinstance(count, bool) or not isinstance(count, int) or count < 0:
        raise ValueError('Invalid transaction count')
    return {'obligations': value, 'transactions': count,
            'latest_action_date': payload.get('latest_action_date'),
            'messages': payload.get('messages', []),
            'period_start': f'{year-1}-10-01', 'period_end': f'{year}-09-30',
            'source': BASE + f'/api/v2/agency/{code}/awards/?' + urllib.parse.urlencode({'fiscal_year': year, 'agency_type': 'funding'})}


def main():
    inventory = json.loads((ROOT / 'data/agencies.json').read_text())
    agencies = inventory['agencies']
    now = dt.datetime.now(dt.timezone.utc)
    current_fy = now.year + (now.month >= 10)
    latest_reported_fy = max(int(a['raw']['active_fy']) for a in agencies if a['raw'].get('active_fy'))
    latest_fy = min(current_fy, latest_reported_fy)
    years = list(range(2024, latest_fy + 1))
    records = {a['code']: {'code': a['code'], 'name': a['name'], 'years': {}} for a in agencies}
    failures = []
    def fetch(a, year):
        code = a['code']
        return observation(get(f'/api/v2/agency/{code}/awards/', {'fiscal_year': year, 'agency_type': 'funding'}), code, year)
    with ThreadPoolExecutor(max_workers=6) as pool:
        tasks = {pool.submit(fetch, a, year): (a['code'], year) for a in agencies for year in years}
        for i, task in enumerate(as_completed(tasks), 1):
            code, year = tasks[task]
            try:
                records[code]['years'][str(year)] = task.result()
            except Exception as exc:
                failures.append({'agency': code, 'year': year, 'error': str(exc)[:240]})
                print(f'Missing {code} FY{year}: {exc}', flush=True)
            if i % 25 == 0:
                print(f'Completed {i}/{len(tasks)} agency-year requests', flush=True)
    expected = len(agencies) * len(years)
    if expected - len(failures) < expected * .95:
        raise RuntimeError(f'Only {expected-len(failures)}/{expected} observations verified; preserving published files')
    result = {'source': 'USAspending.gov official agency award obligations API',
              'retrieved_at_utc': now.isoformat(), 'fiscal_years': years,
              'coverage': inventory['coverage'],
              'definition': 'Funding-agency award obligations. Not appropriations, outlays, total spending, or program cancellations.',
              'comparability': f'Latest available fiscal year: FY{latest_fy}. Current FY{current_fy} may not yet have submissions. Any current fiscal year is partial. Fiscal years do not isolate changes since January 20, 2025. Records may be revised. Missing observations are absent, never zero.',
              'agencies': sorted(records.values(), key=lambda a: a['name'].lower()),
              'expected_observations': expected, 'verified_observations': expected-len(failures), 'errors': failures}
    content = json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False) + '\n'
    snapshot = ROOT / 'data/snapshots' / now.date().isoformat()
    snapshot.mkdir(parents=True, exist_ok=True)
    (snapshot / 'agency-awards.json').write_text(content)
    (snapshot / 'agencies.json').write_text((ROOT / 'data/agencies.json').read_text())
    (ROOT / 'data/agency-awards.json').write_text(content)
    print(f'Published {len(records)} agencies; {len(failures)} missing observations', flush=True)

if __name__ == '__main__':
    main()
