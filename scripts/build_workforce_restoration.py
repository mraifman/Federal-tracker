#!/usr/bin/env python3
"""Build the workforce "repair bill": positions, grades and payroll needed to
restore the non-defense federal workforce to its last pre-transition level.

Reads the same versioned OPM FedScope Employment parquet files used elsewhere in
the pipeline (one micro-record per employee, with grade, pay plan and
annualized adjusted basic pay) and emits data/workforce-restoration.json.

Restoration target: the last OPM month-end snapshot before January 19, 2025
(December 31, 2024). "Positions to restore" is the sum of per-occupation NET
declines, so growth in one career field does not mask losses in another, while
offsetting growth is not double-counted as it would be at the agency x
occupation grain. Defense is reported separately and excluded from the headline
because September defense submissions are incomplete.

Redacted salaries (OPM withholds ~46% government-wide, concentrated in defense)
are imputed from the baseline average of the same pay-plan+grade, then the same
occupation, then the non-defense mean. Salaries outside [10k, 500k] are treated
as unreported to drop obvious sentinel/erroneous values.
"""
import argparse, json, pathlib
from collections import defaultdict
import pyarrow.parquet as pq

ROOT = pathlib.Path(__file__).resolve().parents[1]
COLUMNS = ['department_code', 'department', 'occupational_series_code',
           'occupational_series', 'grade', 'pay_plan_code',
           'annualized_adjusted_basic_pay', 'count']
LOADING = 1.33  # benefits + overhead multiplier on base pay
SAL_MIN, SAL_MAX = 10_000, 500_000


def parse_salary(x):
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    return v if SAL_MIN <= v <= SAL_MAX else None


def read_period(raw_dir, period):
    """Return aggregates for one period plus baseline salary accumulators."""
    path = pathlib.Path(raw_dir) / f'emp-{period}.parquet'
    t = pq.read_table(path, columns=COLUMNS)
    cols = {c: t[c].to_pylist() for c in COLUMNS}
    occ = defaultdict(int)          # non-defense occupation code -> count
    occ_name, dep_name = {}, {}
    grade = defaultdict(int)        # (pay_plan, grade) -> count (non-defense)
    dep = defaultdict(int)          # department_code -> count (non-defense)
    dep_all = defaultdict(int)      # department_code -> count (all)
    dep_occ = defaultdict(int)      # (department_code, occ) -> count (non-defense)
    sal_occ = defaultdict(lambda: [0.0, 0])
    sal_grade = defaultdict(lambda: [0.0, 0])
    total = nd_total = sal_reported = sal_rows = 0
    for d, dn, o, on, g, pp, s, c in zip(
            cols['department_code'], cols['department'],
            cols['occupational_series_code'], cols['occupational_series'],
            cols['grade'], cols['pay_plan_code'],
            cols['annualized_adjusted_basic_pay'], cols['count']):
        try:
            c = int(c)
        except (TypeError, ValueError):
            c = 1
        total += c
        nd = d != 'DOD'
        v = parse_salary(s)
        if not nd:
            dep_all[d] += c
            continue
        nd_total += c
        sal_rows += c          # salary coverage reported for non-defense only
        if v is not None:
            sal_reported += c
        occ[o] += c
        occ_name[o] = on or o
        dep[d] += c
        dep_all[d] += c
        dep_name[d] = dn or d
        dep_occ[(d, o)] += c
        grade[(pp, g)] += c
        if v is not None:
            sal_occ[o][0] += v * c; sal_occ[o][1] += c
            sal_grade[(pp, g)][0] += v * c; sal_grade[(pp, g)][1] += c
    return {
        'occ': occ, 'occ_name': occ_name, 'dep_name': dep_name,
        'grade': grade, 'dep': dep, 'dep_all': dep_all, 'dep_occ': dep_occ,
        'total': total, 'nd_total': nd_total,
        'sal_occ': sal_occ, 'sal_grade': sal_grade,
        'sal_reported': sal_reported, 'sal_rows': sal_rows,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--raw', default='/tmp/federal-atlas-workforce',
                    help='directory holding emp-<period>.parquet files')
    ap.add_argument('--baseline', default='202412')
    ap.add_argument('--comparison', default='202609')
    ap.add_argument('--alternate', default='202608')
    a = ap.parse_args()

    periods = [a.baseline, a.comparison, a.alternate]
    data = {p: read_period(a.raw, p) for p in periods}
    base = data[a.baseline]

    # Baseline salary model (non-defense), with imputation hierarchy.
    occ_avg = {o: s / n for o, (s, n) in base['sal_occ'].items() if n}
    grade_avg = {k: s / n for k, (s, n) in base['sal_grade'].items() if n}
    nd_mean = (sum(s for s, _ in base['sal_occ'].values())
               / sum(n for _, n in base['sal_occ'].values()))

    def salary_for(occ_code):
        return occ_avg.get(occ_code, nd_mean)

    all_occ = set().union(*(data[p]['occ'] for p in periods))
    occ_name = {}
    for p in periods:
        occ_name.update(data[p]['occ_name'])

    def scope_block(comp):
        """Headline figures for baseline -> comp."""
        c = data[comp]
        # per-occupation net (non-defense)
        restore = cost = 0
        for o in all_occ:
            net = c['occ'].get(o, 0) - base['occ'].get(o, 0)
            if net < 0:
                restore += -net
                cost += (-net) * salary_for(o)
        nd_net = c['nd_total'] - base['nd_total']
        all_net = c['total'] - base['total']
        return {
            'baseline_count': base['nd_total'],
            'latest_count': c['nd_total'],
            'net_change': nd_net,
            'positions_to_restore': restore,
            'base_payroll': round(cost),
            'loaded_payroll': round(cost * LOADING),
            'loading_factor': LOADING,
            'all_baseline_count': base['total'],
            'all_latest_count': c['total'],
            'all_net_change': all_net,
        }

    # department names (union across periods)
    dep_name = {}
    for p in periods:
        dep_name.update(data[p]['dep_name'])

    # hardest-hit agency per occupation, for drill-down targets
    comp = data[a.comparison]
    occ_top_agency = {}
    occ_dep_net = defaultdict(lambda: defaultdict(int))
    for (d, o) in set(base['dep_occ']) | set(comp['dep_occ']):
        occ_dep_net[o][d] = comp['dep_occ'].get((d, o), 0) - base['dep_occ'].get((d, o), 0)
    for o, deps in occ_dep_net.items():
        d, net = min(deps.items(), key=lambda kv: kv[1])
        if net < 0:
            occ_top_agency[o] = {'code': d, 'name': dep_name.get(d, d), 'net': net}

    # by occupation (non-defense) for the primary comparison
    by_occupation = []
    for o in all_occ:
        b = base['occ'].get(o, 0); l = comp['occ'].get(o, 0)
        net = l - b
        sal = salary_for(o)
        by_occupation.append({
            'code': o, 'name': occ_name.get(o, o),
            'baseline': b, 'latest': l, 'net': net,
            'avg_salary': round(sal),
            'imputed_salary': o not in occ_avg,
            'restore_count': max(0, -net),
            'restore_cost': round(max(0, -net) * sal),
            'top_agency': occ_top_agency.get(o),
        })
    by_occupation.sort(key=lambda r: r['net'])

    # by grade (non-defense), GS rollup and full pay-plan detail
    all_grade = set().union(*(data[p]['grade'] for p in periods))
    by_grade = []
    for (pp, g) in all_grade:
        b = base['grade'].get((pp, g), 0); l = comp['grade'].get((pp, g), 0)
        avg = grade_avg.get((pp, g))
        by_grade.append({
            'pay_plan': pp, 'grade': g,
            'baseline': b, 'latest': l, 'net': l - b,
            'avg_salary': round(avg) if avg else None,
        })
    by_grade.sort(key=lambda r: r['net'])

    # by agency (non-defense), named
    all_dep = set().union(*(data[p]['dep'] for p in periods))
    placeholder = ('no data', 'not reported', 'unknown', 'redacted')
    by_agency = []
    for d in all_dep:
        name = dep_name.get(d, d)
        if any(w in name.lower() for w in placeholder):
            continue  # OPM placeholder department, not a real agency
        b = base['dep'].get(d, 0); l = comp['dep'].get(d, 0)
        by_agency.append({
            'code': d, 'name': dep_name.get(d, d),
            'baseline': b, 'latest': l, 'net': l - b,
            'pct': round((l / b - 1) * 100, 1) if b else None,
        })
    by_agency.sort(key=lambda r: r['net'])

    out = {
        'retrieved_on': '2026-11-08',
        'baseline': {'period': a.baseline, 'label': 'December 31, 2024'},
        'comparison': {'period': a.comparison, 'label': 'September 30, 2026'},
        'alternate': {'period': a.alternate, 'label': 'August 31, 2026'},
        'methodology': {
            'target': 'Restore each non-defense occupation to its December 31, 2024 level (last OPM snapshot before January 19, 2025).',
            'positions': 'Sum of per-occupation NET declines across non-defense agencies. Growth in one field does not offset losses in another, and offsetting growth is not double-counted.',
            'cost': f'Baseline average salary per occupation x positions to restore, loaded x{LOADING} for benefits and overhead. Base payroll excludes the loading.',
            'salary_imputation': 'Redacted salaries (OPM withholds ~46% government-wide, concentrated in defense) are imputed from the baseline average of the same pay-plan+grade, then occupation, then the non-defense mean. Values outside [10k, 500k] are treated as unreported.',
            'defense': 'Defense civilians are excluded from the headline; September defense submissions are incomplete (~10,000 records missing).',
            'caveats': 'Net headcount change is not a count of layoffs. Some turnover is ordinary attrition. Restoring to the pre-transition level is a policy choice, not an established staffing requirement.',
        },
        'salary_coverage': {
            'reported_pct': round(base['sal_reported'] / base['sal_rows'] * 100, 1),
        },
        'headline': scope_block(a.comparison),
        'alternate_headline': scope_block(a.alternate),
        'by_grade': by_grade,
        'by_occupation': by_occupation,
        'by_agency': by_agency,
    }

    dest = ROOT / 'data/workforce-restoration.json'
    dest.write_text(json.dumps(out, separators=(',', ':'), allow_nan=False) + '\n')
    h = out['headline']
    print(f"Wrote {dest}")
    print(f"  non-defense {h['baseline_count']:,} -> {h['latest_count']:,} "
          f"(net {h['net_change']:,})")
    print(f"  positions to restore: {h['positions_to_restore']:,}")
    print(f"  base payroll ${h['base_payroll']/1e9:.1f}B/yr, "
          f"loaded ${h['loaded_payroll']/1e9:.1f}B/yr")
    print(f"  salary reported: {out['salary_coverage']['reported_pct']}%")
    print(f"  occupations: {len(by_occupation)}, grades: {len(by_grade)}, "
          f"agencies: {len(by_agency)}")


if __name__ == '__main__':
    main()
