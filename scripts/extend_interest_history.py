#!/usr/bin/env python3
"""Extend the published interest series from the retained OMB workbook, without changing financial measures."""
import hashlib,json,pathlib,zipfile
from decimal import Decimal
from xml.etree import ElementTree as ET
NS='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
YEARS=(2004,2008,2012,2016,2020,2024,2026)
def extend_history(root,output):
 source=pathlib.Path(root)/'data/raw/budauth_fy2027.xlsx'
 dest=pathlib.Path(output)/'data/budget-structure.json'
 data=json.loads(dest.read_text())
 with zipfile.ZipFile(source) as book:
  strings=[]
  if 'xl/sharedStrings.xml' in book.namelist():
   strings=[''.join(t.text or '' for t in si.iter(NS+'t')) for si in ET.fromstring(book.read('xl/sharedStrings.xml')).iter(NS+'si')]
  def cells(row):
   result={}
   for cell in row.findall(NS+'c'):
    key=''.join(c for c in cell.attrib['r'] if c.isalpha());value=cell.find(NS+'v');text=value.text if value is not None else ''
    if cell.attrib.get('t')=='s':text=strings[int(text)]
    elif cell.attrib.get('t')=='inlineStr':text=''.join(t.text or '' for t in cell.iter(NS+'t'))
    result[key]=text or ''
   return result
  totals={year:Decimal(0) for year in YEARS};columns=None;count=0
  with book.open('xl/worksheets/sheet1.xml') as stream:
   for _,row in ET.iterparse(stream,events=('end',)):
    if row.tag!=NS+'row':continue
    values=cells(row)
    if columns is None:
     columns={year:next((key for key,value in values.items() if value==str(year)),None) for year in YEARS}
     if not all(columns.values()):raise ValueError('OMB workbook is missing a requested historical year')
    elif values.get('K')=='Net interest':
     count+=1
     for year,column in columns.items():totals[year]+=Decimal(values.get(column) or '0')*1000
    row.clear()
 if not count:raise ValueError('No net-interest rows found in the OMB workbook')
 existing={int(row['year']):row['amount'] for row in data['net_interest_trend']}
 for year in (2016,2020,2024,2026):
  if abs(totals[year]-Decimal(str(existing[year])))>Decimal('1'):raise ValueError(f'Net-interest series does not reconcile in {year}')
 for year in (2004,2008,2012):
  if totals[year]<=0:raise ValueError(f'Historical net-interest amount is unavailable in {year}')
  existing[year]=int(totals[year])
 data['net_interest_trend']=[{'year':year,'amount':existing[year]} for year in sorted(existing)]
 data['net_interest_history']={'source':data['source'],'source_file':'data/raw/budauth_fy2027.xlsx','source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'method':'Sum all workbook rows classified Net interest; workbook amounts in thousands converted to nominal dollars. Existing 2016, 2020, 2024 and 2026 values must reconcile before adding history.','measure':'Net budget authority, not outlays or obligations','observations':'Election-year points from 2004 through 2024, plus FY2026. FY2026 is an estimate in the FY2027 budget release.'}
 dest.write_text(json.dumps(data,separators=(',',':'),allow_nan=False)+'\n')
 print('Verified OMB net-interest history: '+json.dumps({year:int(totals[year]) for year in YEARS}))
