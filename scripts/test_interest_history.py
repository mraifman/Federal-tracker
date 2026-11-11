import json,pathlib,tempfile,unittest,zipfile
from xml.sax.saxutils import escape
from extend_interest_history import extend_history
class InterestHistoryTest(unittest.TestCase):
 def fixture(self,root):
  (root/'data/raw').mkdir(parents=True);(root/'out/data').mkdir(parents=True)
  years=[2004,2008,2012,2016,2020,2024,2026]
  columns=list('LMNOPQR')
  def cell(ref,value,text=False):return '<c r="'+ref+'"'+(' t="inlineStr"><is><t>'+escape(str(value))+'</t></is></c>' if text else '><v>'+str(value)+'</v></c>')
  rows=['<row r="1">'+''.join(cell(c+'1',year,True)for c,year in zip(columns,years))+'</row>']
  for row,category,multiplier in [(2,'Net interest',100),(3,'Net interest',-10),(4,'Mandatory',50000)]:
   rows.append('<row r="'+str(row)+'">'+cell('K'+str(row),category,True)+''.join(cell(c+str(row),multiplier*(i+1)if row!=3 else -10)for i,c in enumerate(columns))+'</row>')
  xml='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+''.join(rows)+'</sheetData></worksheet>'
  with zipfile.ZipFile(root/'data/raw/budauth_fy2027.xlsx','w')as book:book.writestr('xl/worksheets/sheet1.xml',xml)
  existing={'source':'retained-test-workbook','net_interest_trend':[{'year':y,'amount':(100*(i+1)-10)*1000}for i,y in enumerate(years)if y>=2016],'choices':{'sentinel':'must remain unchanged'}}
  (root/'out/data/budget-structure.json').write_text(json.dumps(existing));return existing
 def test_extension_preserves_measure_and_unrelated_data(self):
  with tempfile.TemporaryDirectory()as directory:
   root=pathlib.Path(directory);existing=self.fixture(root);extend_history(root,root/'out');actual=json.loads((root/'out/data/budget-structure.json').read_text())
   self.assertEqual([r['year']for r in actual['net_interest_trend']],[2004,2008,2012,2016,2020,2024,2026])
   self.assertEqual(actual['net_interest_trend'][0]['amount'],90000)
   self.assertEqual(actual['choices'],existing['choices'])
   self.assertIn('not outlays or obligations',actual['net_interest_history']['measure'])
 def test_existing_series_must_reconcile(self):
  with tempfile.TemporaryDirectory()as directory:
   root=pathlib.Path(directory);data=self.fixture(root);data['net_interest_trend'][0]['amount']+=1000;(root/'out/data/budget-structure.json').write_text(json.dumps(data))
   with self.assertRaisesRegex(ValueError,'does not reconcile'):extend_history(root,root/'out')
if __name__=='__main__':unittest.main()
