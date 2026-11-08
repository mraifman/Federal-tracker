#!/usr/bin/env python3
"""The structure of the federal budget: mandatory vs discretionary vs net
interest, and what changed inside the slice Congress actually chooses each year.

Uses the OMB budget-authority database (budget-changes.json for the category x
function detail, topic-budget.json for the multi-year net-interest trajectory),
which carries the BEA category (Discretionary / Mandatory / Net interest) that
the SF 133 execution data does not. Writes data/budget-structure.json.
"""
import json, pathlib
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[1]
A, B = '2024', '2026'
ORDER = ['Mandatory', 'Discretionary', 'Net interest']


def main():
    budget = json.loads((ROOT / 'data/budget-changes.json').read_text())
    topic = json.loads((ROOT / 'data/topic-budget.json').read_text())
    recs = budget['records']

    cat = defaultdict(lambda: {A: 0.0, B: 0.0})
    disc = defaultdict(lambda: [0.0, 0.0])
    for r in recs:
        c = r.get('category', 'Other')
        va, vb = r['values'].get(A), r['values'].get(B)
        if va is not None:
            cat[c][A] += va
        if vb is not None:
            cat[c][B] += vb
        if c == 'Discretionary':
            fn = r.get('function', 'Other')
            disc[fn][0] += va or 0
            disc[fn][1] += vb or 0

    tot_a = sum(cat[c][A] for c in cat)
    tot_b = sum(cat[c][B] for c in cat)
    categories = []
    for c in ORDER:
        a, b = cat[c][A], cat[c][B]
        categories.append({
            'name': c, 'a': round(a), 'b': round(b),
            'pct': round((b / a - 1) * 100, 1) if a else None,
            'share_a': round(a / tot_a * 100, 1), 'share_b': round(b / tot_b * 100, 1),
        })

    # net interest trajectory (topic-budget spans 2009-2027)
    ni = defaultdict(float)
    for r in topic['records']:
        if r.get('category') == 'Net interest':
            for y, v in r['values'].items():
                if v is not None:
                    ni[y] += v
    trend = [{'year': int(y), 'amount': round(ni[y])}
             for y in sorted(ni) if 2015 <= int(y) <= 2027]

    # discretionary changes by function
    changes = sorted(((fn, b - a) for fn, (a, b) in disc.items()), key=lambda x: x[1])
    cuts = [{'function': fn, 'amount': round(v)} for fn, v in changes if v < 0][:7]
    adds = [{'function': fn, 'amount': round(v)} for fn, v in reversed(changes) if v > 0][:4]

    out = {
        'retrieved_on': budget.get('retrieved_on'),
        'source': budget.get('source'),
        'baseline_year': int(A), 'comparison_year': int(B),
        'total': {'a': round(tot_a), 'b': round(tot_b)},
        'categories': categories,
        'net_interest_trend': trend,
        'discretionary': {
            'a': round(cat['Discretionary'][A]), 'b': round(cat['Discretionary'][B]),
            'pct': round((cat['Discretionary'][B] / cat['Discretionary'][A] - 1) * 100, 1),
            'cuts': cuts, 'adds': adds,
        },
        'basis': ('OMB budget-authority database (FY2027 release). Budget authority, '
                  'not outlays. Net interest is gross interest net of offsetting '
                  'collections. FY2027 continuing-resolution figures are not shown.'),
    }
    dest = ROOT / 'data/budget-structure.json'
    dest.write_text(json.dumps(out, separators=(',', ':'), allow_nan=False) + '\n')
    print(f"Wrote {dest}")
    for c in categories:
        print(f"  {c['name']:14} ${c['a']/1e12:.2f}T -> ${c['b']/1e12:.2f}T ({c['pct']:+.1f}%)  "
              f"share {c['share_a']:.0f}% -> {c['share_b']:.0f}%")
    print(f"  net interest: ${trend[0]['amount']/1e9:.0f}B ({trend[0]['year']}) -> "
          f"${trend[-1]['amount']/1e9:.0f}B ({trend[-1]['year']})")
    print(f"  discretionary cuts: {[(c['function'][:24], round(c['amount']/1e9)) for c in cuts[:4]]}")


if __name__ == '__main__':
    main()
