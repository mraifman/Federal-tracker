import unittest
from build_legal_review import screen
class LegalScreenTest(unittest.TestCase):
 def test_signals_do_not_become_legal_findings(self):
  rows=[{'program_code':'a','program_name':'One-time grant','basis':'funding','year':2024,'amount':2e9,'transaction_count':1},
        {'program_code':'b','program_name':'Negative adjustment','basis':'funding','year':2026,'amount':-2e8,'transaction_count':1},
        {'program_code':'excluded','program_name':'Benefit','basis':'funding','year':2024,'amount':3e9,'transaction_count':1}]
  registry={'cases':[],'reviews':[]};result=screen(rows,{'excluded'},registry,'2026-11-08')
  self.assertEqual(result['coverage']['programs_screened'],2)
  self.assertEqual(len(result['queue']),2)
  self.assertTrue(all(r['review_state']=='not_reviewed' for r in result['queue']))
  self.assertEqual(registry,{'cases':[],'reviews':[]})
  self.assertEqual(len(result['queue'][0]['signals']),2)
if __name__=='__main__':unittest.main()
