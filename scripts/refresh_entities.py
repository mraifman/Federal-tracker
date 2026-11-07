#!/usr/bin/env python3
"""Preserve the official Federal Register directory without inferring agency status."""
import datetime as dt
import json
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
URL = 'https://www.federalregister.gov/api/v1/agencies.json'


def validate(data):
    rows = data['entities']
    assert len(rows) == data['count'] and len(rows) >= 100
    ids = {r['id'] for r in rows}
    assert len(ids) == len(rows)
    for row in rows:
        assert isinstance(row['id'], int) and isinstance(row['name'], str) and row['name']
        assert row['url'].startswith('https://www.federalregister.gov/agencies/')
        assert row['parent_id'] is None or row['parent_id'] in ids
    assert data['source'] == URL


def main():
    req = urllib.request.Request(URL, headers={'Accept': 'application/json', 'User-Agent': 'FederalAtlasResearch/1.0'})
    with urllib.request.urlopen(req, timeout=30) as response:
        rows = json.load(response)
    now = dt.datetime.now(dt.timezone.utc)
    data = {'source': URL, 'retrieved_at_utc': now.isoformat(), 'count': len(rows),
            'coverage': 'Federal Register agency directory, including historical entities and subagencies. This is not a complete current federal organizational census. Directory inclusion does not establish operating status, termination, or funding coverage. Parent relationships are reproduced from the source; names are not automatically matched to USAspending.',
            'entities': sorted(rows, key=lambda r: r['name'].lower())}
    validate(data)
    content = json.dumps(data, indent=2, ensure_ascii=False) + '\n'
    (ROOT / 'data/federal-entities.json').write_text(content)
    snapshot = ROOT / 'data/snapshots' / now.date().isoformat()
    snapshot.mkdir(parents=True, exist_ok=True)
    (snapshot / 'federal-entities.json').write_text(content)
    print(f'Validated and wrote {len(rows)} official Federal Register directory records')

if __name__ == '__main__':
    main()
