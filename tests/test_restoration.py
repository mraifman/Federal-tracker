"""Regression coverage for grade-specific restoration pricing (requires pyarrow)."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

try:
    import pyarrow as pa
    import pyarrow.parquet as pq
except ImportError:
    pa = None


@unittest.skipIf(pa is None, 'pyarrow is required for source-parquet fixtures')
class RestorationPricingTest(unittest.TestCase):
    def test_grade_growth_does_not_offset_decline_and_fallback_is_explicit(self):
        script = Path(__file__).resolve().parents[1] / 'scripts/build_workforce_restoration.py'
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'scripts').mkdir()
            (root / 'data').mkdir()
            (root / 'scripts/build_workforce_restoration.py').write_text(script.read_text())
            def row(occ, grade, salary, count, department='AG'):
                return dict(department_code=department, department=department,
                    occupational_series_code=occ, occupational_series=occ,
                    grade=grade, pay_plan_code='GS', annualized_adjusted_basic_pay=salary,
                    count=count)
            base = [row('0001', '12', '100000', 10), row('0001', '13', '150000', 2),
                    row('0002', '12', None, 2), row('0003', '12', '120000', 2),
                    row('0001', '12', '100000', 100, 'DOD')]
            end = [row('0001', '12', '100000', 6), row('0001', '13', '150000', 6),
                   row('0002', '12', None, 1), row('0003', '12', '120000', 2)]
            for period, rows in [('202412', base), ('202609', end), ('202608', end)]:
                pq.write_table(pa.Table.from_pylist(rows), root / f'emp-{period}.parquet')
            subprocess.run([sys.executable, str(root / 'scripts/build_workforce_restoration.py'),
                            '--raw', str(root)], check=True, capture_output=True)
            data = json.loads((root / 'data/workforce-restoration.json').read_text())
            h = data['headline']
            self.assertEqual(h['net_change'], -1)
            self.assertEqual(h['positions_to_restore'], 5)
            # Four GS-12 positions at $100k, plus one with a withheld salary
            # priced from reported GS-12 peers: (10*$100k + 2*$120k)/12.
            cost = 4 * 100000 + 1240000 / 12
            self.assertEqual(h['base_payroll'], round(cost))
            self.assertEqual(h['loaded_payroll'], round(cost * 1.33))
            groups = data['restoration_by_group']
            self.assertEqual(len(groups), 2)
            self.assertEqual(next(g for g in groups if g['occupation']=='0002')['salary_basis'],
                             'pay_plan_grade')
            self.assertEqual(sum(g['restore_count'] for g in groups), 5)


if __name__ == '__main__':
    unittest.main()
