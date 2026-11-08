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

# Curated federal roles that touch daily life, each backed by real OPM
# occupational-series counts. (agency = the department to open on drill-down.)
# Roles that grew over the period (air traffic control, border, park rangers,
# wildland fire) are deliberately excluded; this feature is about the cuts.
SERVICE_ROLES = [
    ('Health & consumer safety', 'USDA Food Safety Inspectors', 'AG', ['AG|role|1862', 'AG|role|1863'],
     'Inspect meat, poultry and egg products to prevent foodborne illness.'),
    ('Health & consumer safety', 'Consumer Safety Officers', 'HE', ['HE|role|0696'],
     'Check the safety of medicines, medical devices and consumer products.'),
    ('Health & consumer safety', 'Public Health Scientists', 'HE', ['HE|role|0601'],
     'Track disease, study health risks and help prevent outbreaks.'),
    ('Health & consumer safety', 'Workplace Safety Specialists', 'DL', ['DL|role|0018'],
     'Help prevent workplace injuries and enforce safety standards.'),
    ('Economic security & lifelines', 'Social Security Claims Specialists', 'SZ', ['SZ|role|0105'],
     'Help retirees, disabled people and surviving families claim benefits.'),
    ('Economic security & lifelines', 'Taxpayer Phone Representatives', 'TR', ['TR|role|0962'],
     'Answer questions about tax returns, payments and refunds.'),
    ('Economic security & lifelines', 'Revenue Agents', 'TR', ['TR|role|0512'],
     'Audit complex tax returns and enforce tax law.'),
    ('Economic security & lifelines', 'Emergency Management Specialists', 'HS', ['HS|role|0089'],
     'Plan for disasters, coordinate response and help communities recover.'),
    ('Environment, science & safety', 'Meteorologists', 'CM', ['CM|role|1340'],
     'Forecast weather and warn of hurricanes, tornadoes and floods.'),
    ('Environment, science & safety', 'Park Rangers', 'IN', ['IN|role|0025'],
     'Protect parks, guide visitors and help with search and rescue.'),
    ('Environment, science & safety', 'USGS Hydrologic Technicians', 'IN', ['IN|IN08|role|1316'],
     'Monitor rivers and groundwater to support flood warnings and water supplies.'),
    ('Environment, science & safety', 'Interior Biologists & Natural-Resource Specialists', 'IN', ['IN|role|0401'],
     'Protect wildlife, habitats and public lands.'),
    ('Environment, science & safety', 'EPA Environmental Protection Specialists', 'EP', ['EP|role|0028'],
     'Protect air and water through environmental programs.'),
]


def build_seasonal_note(baseline, comparison):
    """Park Service example of seasonal masking: the September snapshot (summer
    peak) flatters seasonal agencies, so a same-season year-over-year change is
    the honest measure. Uses the latest available December (one year after the
    baseline)."""
    w = json.loads((ROOT / 'data/workforce-changes.json').read_text())
    periods = w['periods']
    yoy = next((p for p in periods if p.startswith(str(int(baseline[:4]) + 1))
                and p[4:] == baseline[4:]), None)
    nps = next((r for r in w['records']['subagencies'] if r['id'] == 'IN|IN10'), None)
    if not nps or not yoy:
        return None
    v = nps['values']
    base, head, season = v.get(baseline), v.get(comparison), v.get(yoy)
    if not base:
        return None
    return {
        'agency': 'National Park Service',
        'baseline': base, 'headline_latest': head, 'yoy_latest': season,
        'headline_pct': round((head / base - 1) * 100, 1) if head else None,
        'yoy_pct': round((season / base - 1) * 100, 1) if season else None,
        'yoy_label': 'December 2024 to December 2025',
    }


# Seasonal roles whose September snapshot is a summer peak are compared
# year-over-year (same month) instead, so their real decline is not masked.
SEASONAL_BASIS = {'Park Rangers': '202512'}


def build_service_roles(baseline, comparison):
    roles = json.loads((ROOT / 'data/workforce-roles.json').read_text())
    by_id = {r['id']: r for r in roles['records']}
    out = []
    for category, label, agency, ids, desc in SERVICE_ROLES:
        cmp = SEASONAL_BASIS.get(label, comparison)
        a = b = 0
        for rid in ids:
            r = by_id.get(rid)
            if not r:
                continue
            a += r['values'].get(baseline, 0) or 0
            b += r['values'].get(cmp, 0) or 0
        row = {
            'category': category, 'label': label, 'agency': agency,
            'description': desc, 'baseline': a, 'latest': b, 'net': b - a,
            'pct': round((b / a - 1) * 100, 1) if a else None,
        }
        if label in SEASONAL_BASIS:
            row['seasonal'] = True
            row['basis_note'] = 'year-over-year'
        out.append(row)
    return out


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
    # actual cash: SF 133 net outlays (line 4190)
    oy24 = oy26 = 0.0
    topic_outlay = defaultdict(float)
    for r in rows:
        a = value(r, '2024', evidence)
        b = value(r, '2026', evidence)
        if a is not None:
            fy24 += a
        if b is not None:
            fy26 += b
        topic = r.get('topic', 'Unclassified')
        topic_code[topic] = r.get('topic_code')
        oa = value(r, '2024', evidence, 'net_outlays')
        ob = value(r, '2026', evidence, 'net_outlays')
        if oa is not None:
            oy24 += oa
        if ob is not None:
            oy26 += ob
        if oa is not None and ob is not None:
            topic_outlay[topic] += ob - oa
        if a is None or b is None:
            continue
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

    # outlay cuts (most negative change) and surges (most positive)
    outlay_sorted = sorted(topic_outlay.items(), key=lambda kv: kv[1])
    outlay_cuts = [{'topic': t, 'topic_code': topic_code.get(t), 'amount': round(v)}
                   for t, v in outlay_sorted if v < 0][:6]
    outlay_surges = [{'topic': t, 'topic_code': topic_code.get(t), 'amount': round(v)}
                     for t, v in reversed(outlay_sorted) if v > 0][:3]

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
        'service_roles': build_service_roles(
            restoration['baseline']['period'], restoration['comparison']['period']),
        'seasonal_note': build_seasonal_note(
            restoration['baseline']['period'], restoration['comparison']['period']),
        'funding': {
            'metric': METRIC,
            'fy2024_total': round(fy24),
            'fy2026_total': round(fy26),
            'restore_total': round(cut),
            'increase_total': round(grew),
            'top_cut_topics': top_topics,
            'top_increase_topics': topic_list(topic_grew),
            'outlays': {
                'fy2024_total': round(oy24),
                'fy2026_total': round(oy26),
                'total_pct': round((oy26 / oy24 - 1) * 100, 1) if oy24 else None,
                'cut_topics': outlay_cuts,
                'surge_topics': outlay_surges,
                'basis': 'Actual cash paid out: SF 133 net outlays (line 4190), FY2024 vs FY2026, non-financing accounts. Outlays settle commitments from this and prior years, a different measure from new budget authority or obligations.',
            },
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
    for t in top_topics:
        print(f"    {t['topic'][:44]:44} ${t['amount']/1e9:6.1f}B")


if __name__ == '__main__':
    main()
