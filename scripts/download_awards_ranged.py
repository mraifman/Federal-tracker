#!/usr/bin/env python3
"""Resumable, validated byte-range retrieval of official government-wide archives."""
import concurrent.futures,hashlib,json,math,pathlib,subprocess,zipfile
CACHE=pathlib.Path('/tmp/federal-atlas-award-archives');CHUNK=8*1024*1024
manifest=json.loads((CACHE/'manifest.json').read_text());sizes={'FY2024_All_Assistance_Full_20261006.zip':1329293800,'FY2024_All_Contracts_Full_20261006.zip':2039742911,'FY2026_All_Assistance_Full_20261006.zip':1102410331,'FY2026_All_Contracts_Full_20261006.zip':1528216874}
def chunks_for(r):
 folder=CACHE/(r['file_name']+'.chunks');folder.mkdir(exist_ok=True);size=sizes[r['file_name']];old=CACHE/(r['file_name']+'.part')
 if old.exists():
  with old.open('rb') as f:
   for i in range(old.stat().st_size//CHUNK):
    p=folder/f'{i:05d}';data=f.read(CHUNK)
    if not p.exists():p.write_bytes(data)
 return [(r,i,i*CHUNK,min(size,(i+1)*CHUNK)-1,folder/f'{i:05d}') for i in range(math.ceil(size/CHUNK))]
def fetch(job):
 r,i,start,end,path=job;expected=end-start+1
 if path.exists() and path.stat().st_size==expected:return
 tmp=path.with_suffix('.tmp')
 for attempt in range(4):
  code=subprocess.run(['curl','-fsSL','--max-time','80','-r',f'{start}-{end}','-w','%{http_code}','-o',str(tmp),r['url']],capture_output=True,text=True)
  if code.returncode==0 and code.stdout.strip()=='206' and tmp.stat().st_size==expected:tmp.replace(path);return
 raise RuntimeError(f"Range retrieval failed: {r['file_name']} chunk {i}: HTTP {code.stdout.strip()}")
def main():
 jobs=[j for r in manifest if not (CACHE/r['file_name']).exists() for j in chunks_for(r)];print('Retrieving',len(jobs),'verified byte ranges across four complete archives',flush=True)
 with concurrent.futures.ThreadPoolExecutor(max_workers=32) as pool:
  futures=[pool.submit(fetch,j) for j in jobs]
  for i,f in enumerate(concurrent.futures.as_completed(futures),1):
   f.result()
   if i%40==0:print('Range progress',i,'/',len(jobs),flush=True)
 receipts=[]
 for r in manifest:
  target=CACHE/r['file_name']
  if not target.exists():
   folder=CACHE/(r['file_name']+'.chunks');assembly=target.with_suffix('.assembling')
   with assembly.open('wb') as out:
    for i in range(math.ceil(sizes[r['file_name']]/CHUNK)):
     with (folder/f'{i:05d}').open('rb') as inp:
      while data:=inp.read(4*1024*1024):out.write(data)
   assert assembly.stat().st_size==sizes[r['file_name']];assembly.replace(target)
  with zipfile.ZipFile(target) as z:assert z.namelist();entries=[{'name':x.filename,'compressed_bytes':x.compress_size,'uncompressed_bytes':x.file_size} for x in z.infolist()]
  h=hashlib.sha256()
  with target.open('rb') as f:
   while block:=f.read(8*1024*1024):h.update(block)
  receipts.append({**r,'bytes':target.stat().st_size,'sha256':h.hexdigest(),'entries':entries});print('Verified complete archive',target.name,flush=True)
 (CACHE/'download-receipts.json').write_text(json.dumps(receipts,indent=2));print('All archive receipts saved.',flush=True)
if __name__=='__main__':main()
