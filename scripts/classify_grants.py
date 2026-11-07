"""Assign every grant program row a subject and its official listing as subsubject."""
import gzip,json,pathlib,re
root=pathlib.Path(__file__).resolve().parents[1]/'data'
rules=[('Health & medicine',r'health|medic|disease|cancer|biomed|nursing|immun|clinical|mental illness|hiv|hospital|nih research|aging research|biolog|drug abuse'),('Environment & climate',r'climate|conservation|environment|clean water|ecosystem|wildlife|pollution|wetland|ocean|forest|weather'),('Energy',r'energy|electric grid|renewable|nuclear'),('Education & training',r'education|student|school|teacher|literacy|training'),('Transportation',r'transport|railroad|highway|airport|aviation|transit'),('Housing & community development',r'housing|homeless|community development|rental assistance'),('Food & agriculture',r'agricultur|nutrition|food|farm|crop'),('Public safety & justice',r'justice|crime|polic|law enforcement|victim|correction'),('Disaster response',r'disaster|emergency preparedness|hazard mitigation'),('Science & technology',r'science|technology|engineering|research infrastructure'),('Economic development & employment',r'economic development|workforce|employment|small business'),('Arts & culture',r'arts|humanities|museum|librar'),('Social services',r'child welfare|family services|social services|child care'),('International affairs',r'international development|foreign assistance|humanitarian')]
topics={r['topic_code']:r['topic'] for r in json.loads((root/'authority-comparison.json').read_text())['records']}
catalog={}
for p in sorted((root/'outbound').glob('*.json.gz')):
 if '-recipients' in p.name:continue
 for r in json.loads(gzip.decompress(p.read_bytes()))['programs']:
  if r['award_kind']!='Grants / cooperative agreements':continue
  key=r['program_code'];entry=catalog.setdefault(key,{'titles':set(),'topics':set()});entry['titles'].add(r['program_name']);entry['topics'].add(r['topic_code'])
result={}
for code,e in catalog.items():
 titles=sorted(e['titles']);name=next((v for v in titles if v), 'Listing title unreported');matches=[subject for subject,pattern in rules if re.search(pattern,' '.join(titles),re.I)]
 known=e['topics']-{'unallocated','mixed','unclassified'}
 subject=matches[0] if matches else topics[next(iter(known))] if len(known)==1 else 'Purpose unresolved'
 result[code]={'subject':subject,'subsubject':name,'basis':'Listing title rule' if matches else 'Unique matched account purpose' if len(known)==1 else 'Insufficient purpose evidence','additional_title_matches':matches[1:]}
(root/'grant-subjects.json').write_text(json.dumps(result,separators=(',',':')))
print(len(result),'grant listing codes;',sum(r['subject']=='Purpose unresolved' for r in result.values()),'unresolved')
