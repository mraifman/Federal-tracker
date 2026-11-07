#!/usr/bin/env python3
"""Download the exact versioned OPM sources in the published workforce manifest."""
import argparse,concurrent.futures,hashlib,json,pathlib,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[1]
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 p=argparse.ArgumentParser();p.add_argument('--directory',default='/tmp/federal-atlas-workforce');a=p.parse_args();out=pathlib.Path(a.directory);out.mkdir(parents=True,exist_ok=True)
 sources=json.loads((ROOT/'data/workforce-changes.json').read_text())['sources']
 def fetch(s):
  target=out/('employment-'+s['period']+'.parquet')
  if not target.exists() or digest(target)!=s['sha256']:
   tmp=target.with_suffix('.download')
   subprocess.run(['curl','-sS','-L','--fail','--retry','2','--max-time','180',s['url'],'-o',str(tmp)],check=True)
   assert digest(tmp)==s['sha256'],f"Unexpected source content for {s['period']}"
   tmp.replace(target)
  return [s['period'],str(target),s['version']]
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:manifest=list(pool.map(fetch,sources))
 path=out/'manifest.json';path.write_text(json.dumps(sorted(manifest),indent=2)+'\n');print(path)
if __name__=='__main__':main()
