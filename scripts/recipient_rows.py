"""Iterate legacy or fully disaggregated recipient archives without loading all sectors."""
import gzip,json,pathlib

def recipient_rows(root,path,basis=None):
 root=pathlib.Path(root)
 def read(name):return json.loads(gzip.decompress((root/name).read_bytes()))
 manifest=read(path)
 if isinstance(manifest,list):
  yield from (r for r in manifest if basis is None or r['basis']==basis)
  return
 assert manifest['format']=='recipient-shards-v1'
 for shard in manifest['shards']:
  if basis and shard['basis']!=basis:continue
  data=read(shard['file']);assert data['format']=='recipient-rows-v1';assert len(data['rows'])==shard['rows']
  for year,pc,rid,topic,kind,env,amount,count,known in data['rows']:
   program_code,program_name=data['programs'][pc];recipient_id,recipient_name=data['recipients'][rid]
   assert recipient_id!='OTHER_RECIPIENTS','Every organizational recipient must remain named'
   if data['sector']=='Individuals':assert recipient_id=='INDIVIDUALS'
   yield dict(basis=data['basis'],sector=data['sector'],year=year,program_code=program_code,program_name=program_name,recipient_id=recipient_id,recipient_name=recipient_name,topic_code=topic,award_kind=kind,environment_lens=env,amount=amount,transaction_count=count,known_amount_count=known)
