#!/usr/bin/env python3
"""The outlay narrative: fewer employees administering more money ("do more with
less"). For each agency with both an OPM headcount and a matched account-
obligation series, compare the staffing change to the obligation change and to
the obligations-per-employee ratio. Government-wide figures use the same matched
set so staff and dollars are consistent.

Writes data/outlay-pressure.json. Obligations are Oct-Aug account obligations
(spending-comparison.json); headcount is Dec 2024 vs Sep 2026 (workforce-
changes.json); the two are different measures and periods, which the copy notes.
"""
import json, pathlib
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE, END = '202412', '202609'
MIN_STAFF = 3000  # keep real-sized agencies; drop tiny noisy commissions


def main():
    spend = json.loads((ROOT / 'data/spending-comparison.json').read_text())
    work = json.loads((ROOT / 'data/workforce-changes.json').read_text())
    links = json.loads((ROOT / 'data/spending-workforce-crosswalk.json').read_text())['links']
    recs = {r['id']: r for r in work['records']['departments'] + work['records']['subagencies']}

    def obligations(rec, year):
        oc = rec['years'].get(year, {}).get('object_class', {}).get('records', [])
        return sum(x['amount'] for x in oc)

    agencies = []
    for rec in spend['records']:
        opm = links.get(rec['code'])
        if not opm or '|' in opm:   # dept-level only, so staff totals don't double-count subagencies
            continue
        w = recs.get(opm)
        if not w:
            continue
        sa, sb = w['values'].get(BASE), w['values'].get(END)
        oa, ob = obligations(rec, '2024'), obligations(rec, '2026')
        if not sa or not sb or oa <= 0 or ob <= 0 or sa < MIN_STAFF:
            continue
        agencies.append({
            'code': rec['code'], 'opm': opm, 'name': rec['name'],
            'staff_a': sa, 'staff_b': sb, 'staff_pct': round((sb / sa - 1) * 100, 1),
            'oblig_a': oa, 'oblig_b': ob, 'oblig_pct': round((ob / oa - 1) * 100, 1),
            'per_employee_a': oa / sa, 'per_employee_b': ob / sb,
            'per_employee_pct': round(((ob / sb) / (oa / sa) - 1) * 100, 1),
        })

    # government-wide over the matched set (consistent staff + dollars)
    ssa = sum(a['staff_a'] for a in agencies); ssb = sum(a['staff_b'] for a in agencies)
    soa = sum(a['oblig_a'] for a in agencies); sob = sum(a['oblig_b'] for a in agencies)
    gov = {
        'staff_a': ssa, 'staff_b': ssb, 'staff_pct': round((ssb / ssa - 1) * 100, 1),
        'oblig_a': round(soa), 'oblig_b': round(sob), 'oblig_pct': round((sob / soa - 1) * 100, 1),
        'per_employee_a': round(soa / ssa), 'per_employee_b': round(sob / ssb),
        'per_employee_pct': round(((sob / ssb) / (soa / ssa) - 1) * 100, 1),
        'matched_agencies': len(agencies),
    }

    # object-class mix government-wide (what the money buys) - is it outsourcing?
    oc_a, oc_b, oc_name = defaultdict(float), defaultdict(float), {}
    for rec in spend['records']:
        for y, acc in [('2024', oc_a), ('2026', oc_b)]:
            for x in rec['years'].get(y, {}).get('object_class', {}).get('records', []):
                acc[x['code']] += x['amount']; oc_name[x['code']] = x['name']
    ta, tb = sum(oc_a.values()), sum(oc_b.values())
    mix = sorted(([c, oc_name[c], round(oc_a[c] / ta * 100, 1), round(oc_b[c] / tb * 100, 1)]
                  for c in oc_a), key=lambda r: -r[3])
    object_mix = [{'code': c, 'name': n, 'share_a': a, 'share_b': b, 'shift_pp': round(b - a, 1)}
                  for c, n, a, b in mix[:6]]

    # leaders: real squeeze = staff down while per-employee load rose
    squeeze = sorted([a for a in agencies if a['staff_pct'] < 0 and a['per_employee_pct'] > 0],
                     key=lambda a: -a['per_employee_pct'])

    out = {
        'retrieved_on': spend.get('retrieved_on'),
        'period_note': 'Headcount: OPM December 2024 vs September 2026. Obligations: account obligations for October-August, FY2024 vs FY2026 (spending-comparison.json). Different measures and periods; obligations are commitments, not cash outlays.',
        'government_wide': gov,
        'object_mix': object_mix,
        'agencies': squeeze,
    }
    dest = ROOT / 'data/outlay-pressure.json'
    dest.write_text(json.dumps(out, separators=(',', ':'), allow_nan=False) + '\n')
    g = gov
    print(f"Wrote {dest}")
    print(f"  matched agencies: {g['matched_agencies']}")
    print(f"  staff {g['staff_a']:,} -> {g['staff_b']:,} ({g['staff_pct']}%)")
    print(f"  obligations ${g['oblig_a']/1e9:.0f}B -> ${g['oblig_b']/1e9:.0f}B ({g['oblig_pct']}%)")
    print(f"  per-employee ${g['per_employee_a']/1e6:.2f}M -> ${g['per_employee_b']/1e6:.2f}M ({g['per_employee_pct']}%)")
    print("  top squeeze agencies:")
    for a in squeeze[:8]:
        print(f"    {a['name'][:34]:34} staff {a['staff_pct']:>+6.0f}%  $/empl {a['per_employee_pct']:>+6.0f}%")


if __name__ == '__main__':
    main()
