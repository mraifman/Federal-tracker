#!/usr/bin/env python3
"""Download official all-agency full archives into a local research cache, never Git."""
import concurrent.futures,json,pathlib,subprocess,time
ROOT=pathlib.Path(__file__).resolve().parents[1];CACHE=pathlib.Path('/tmp/federal-atlas-award-archives');CACHE.mkdir(exist_ok=True)
def job(r):
 final=CACHE/r['file_name'];part=final.with_suffix('.zip.part')
 if not final.exists():
  subprocess.run(['curl','-fsSL','--retry','2','--max-time','1800','-C','-','-o',str(part),r['url']],check=True)
  part.replace(final)
 print('Downloaded',r['file_name'],round(final.stat().st_size/1e9,2),'GB',flush=True);return str(final)
def main():
 jobs=[]
 for year in [2024,2026]:
  for kind in ['assistance','contracts']:
   path=pathlib.Path(f'/tmp/award-archives-{year}-{kind}.json');jobs.append(next(r for r in json.loads(path.read_text())['monthly_files'] if r['fiscal_year']==year))
 (CACHE/'manifest.json').write_text(json.dumps(jobs,indent=2))
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  tasks=[pool.submit(job,r) for r in jobs]
  while not all(t.done() for t in tasks):
   time.sleep(15);print('Archive download progress:',round(sum(p.stat().st_size for p in CACHE.glob('*.part'))/1e9,2),'GB in progress;',sum(t.done() for t in tasks),'complete',flush=True)
  for t in tasks:t.result()
 print('All four government-wide archives downloaded.',flush=True)
if __name__=='__main__':main()
