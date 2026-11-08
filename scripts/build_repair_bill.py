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
    ('Health & consumer safety', 'USDA Food Safety Inspector', 'AG', ['AG|role|1862', 'AG|role|1863'],
     'Inspect meat, poultry and egg products every day, stopping foodborne illness before it reaches your grocery shelf.'),
    ('Health & consumer safety', 'FDA Consumer Safety Officer', 'HE', ['HE|role|0696'],
     'Monitor how medicines, medical devices and cosmetics are made, so the health products you use are safe and effective.'),
    ('Health & consumer safety', 'Public Health Scientist', 'HE', ['HE|role|0601'],
     'Track disease outbreaks and run the labs and studies that keep epidemics from spreading.'),
    ('Health & consumer safety', 'OSHA Workplace Safety Inspector', 'DL', ['DL|role|0018'],
     'Inspect workplaces and enforce the rules that let millions of Americans come home safe from work each day.'),
    ('Economic security & lifelines', 'Social Security Claims Specialist', 'SZ', ['SZ|role|0105'],
     'Help retirees, people with disabilities and surviving spouses actually receive the benefits they earned.'),
    ('Economic security & lifelines', 'IRS Taxpayer Phone Representative', 'TR', ['TR|role|0962'],
     'Answer the phone when you call the IRS with a question about your return or your refund.'),
    ('Economic security & lifelines', 'IRS Revenue Agent', 'TR', ['TR|role|0512'],
     'Audit the most complex returns so the wealthiest taxpayers and corporations pay what they legally owe.'),
    ('Economic security & lifelines', 'FEMA Emergency Management Specialist', 'HS', ['HS|role|0089'],
     'Deploy the moment disaster strikes to coordinate shelter, food and aid so communities can rebuild.'),
    ('Environment, science & safety', 'National Weather Service Meteorologist', 'CM', ['CM|role|1340'],
     'Forecast the hurricanes, tornadoes and floods whose warnings save lives and property.'),
    ('Environment, science & safety', 'Park Ranger', 'IN', ['IN|role|0025'],
     'Protect the national parks, guide visitors and run the search-and-rescue missions when hikers go missing.'),
    ('Environment, science & safety', 'USGS Hydrologic Technician', 'IN', ['IN|IN08|role|1316'],
     "Measure the nation's rivers and groundwater to warn of floods and protect drinking-water supplies."),
    ('Environment, science & safety', 'Interior Biologist & Natural-Resource Specialist', 'IN', ['IN|role|0401'],
     'Protect wildlife, fisheries and the public lands that belong to every American.'),
    ('Environment, science & safety', 'EPA Environmental Protection Specialist', 'EP', ['EP|role|0028'],
     'Run the programs that keep the air you breathe and the water you drink clean.'),
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
SEASONAL_BASIS = {'Park Ranger': '202512'}


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
