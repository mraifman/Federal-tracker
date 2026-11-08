#!/usr/bin/env python3
"""Summarize the funding side of the repair bill: how much reported budget
authority would have to be restored to undo the FY2024 -> FY2026 cuts.

Mirrors the funding view's logic (research.js): non-financing accounts only,
the same value() precedence (source metric, then reconciled derived metric,
then separately verified FY2026 metric), and the same continuity merges from
funding-status-evidence.json, so the figures agree with the on-site funding tab.

Writes data/repair-bill.json. The workforce side of the repair bill is produced
separately by build_workforce_restoration.py.
"""
import json, pathlib
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[1]
METRIC = 'net_authority'


def is_financing(r):
    return not str(r.get('credit_scope')).startswith('NON-')


def case_for(r, evidence):
    for c in evidence.get('record_cases', []):
        if r['id'] in c.get('record_ids', []):
            return c
    return None


def value(r, year, evidence, metric=METRIC):
    yr = r.get('years', {}).get(year)
    if yr:
        m = yr.get('metrics', {}).get(metric)
        if m is not None:
            return m
        dm = yr.get('derived_metrics', {}).get(metric)
        if dm and dm.get('value') is not None:
            return dm['value']
    if year == '2026':
        c = case_for(r, evidence)
        if c and c.get('verified_metrics', {}).get(metric) is not None:
            return c['verified_metrics'][metric]
    return None


def apply_continuity(records, evidence):
    by_id = {r['id']: r for r in records}
    for c in evidence.get('continuity_cases', []):
        prior = by_id.get(c['prior_id'])
        current = by_id.get(c['current_id'])
        if not prior or not current:
            continue
        if prior.get('years', {}).get('2026') or current.get('years', {}).get('2024'):
            continue
        prior.setdefault('years', {})['2026'] = current['years']['2026']
        current['_continuity_hidden'] = True


def main():
    authority = json.loads((ROOT / 'data/authority-comparison.json').read_text())
    evidence = json.loads((ROOT / 'data/funding-status-evidence.json').read_text())
    restoration = json.loads((ROOT / 'data/workforce-restoration.json').read_text())
    records = authority['records']
    apply_continuity(records, evidence)
    rows = [r for r in records if not r.get('_continuity_hidden') and not is_financing(r)]

    fy24 = fy26 = cut = grew = 0.0
    topic_cut = defaultdict(float)
    topic_grew = defaultdict(float)
    topic_code = {}
    for r in rows:
        a = value(r, '2024', evidence)
        b = value(r, '2026', evidence)
        if a is not None:
            fy24 += a
        if b is not None:
            fy26 += b
        if a is None or b is None:
            continue
        topic = r.get('topic', 'Unclassified')
        topic_code[topic] = r.get('topic_code')
        d = b - a
        if d < 0:
            cut += -d
            topic_cut[topic] += -d
        else:
            grew += d
            topic_grew[topic] += d

    def topic_list(agg, n=8):
        return [{'topic': t, 'topic_code': topic_code.get(t), 'amount': round(v)}
                for t, v in sorted(agg.items(), key=lambda kv: -kv[1])[:n]]
    top_topics = topic_list(topic_cut)

    people = restoration['headline']
    out = {
        'retrieved_on': restoration['retrieved_on'],
        'people': {
            'positions_to_restore': people['positions_to_restore'],
            'net_change': people['net_change'],
            'base_payroll': people['base_payroll'],
            'loaded_payroll': people['loaded_payroll'],
            'baseline_count': people['baseline_count'],
            'latest_count': people['latest_count'],
        },
        'funding': {
            'metric': METRIC,
            'fy2024_total': round(fy24),
            'fy2026_total': round(fy26),
            'restore_total': round(cut),
            'increase_total': round(grew),
            'top_cut_topics': top_topics,
            'top_increase_topics': topic_list(topic_grew),
            'basis': ('Sum of FY2024->FY2026 decreases in reported net budget authority '
                      '(line 4180) across non-financing accounts, using the same values '
                      'and continuity merges as the funding view. Defense cuts are '
                      'included in the account total but reporting there is incomplete; '
                      'the civilian-service topics below are the robust story.'),
        },
    }
    dest = ROOT / 'data/repair-bill.json'
    dest.write_text(json.dumps(out, separators=(',', ':'), allow_nan=False) + '\n')
    print(f"Wrote {dest}")
    print(f"  funding FY2024 ${fy24/1e12:.2f}T -> FY2026 ${fy26/1e12:.2f}T")
    print(f"  program funding to restore (gross cuts): ${cut/1e9:.1f}B")
    for t, v in top_topics:
        print(f"    {t[:44]:44} ${v/1e9:6.1f}B")


if __name__ == '__main__':
    main()
