#!/usr/bin/env python3
import concurrent.futures,json,pathlib,subprocess,time
CACHE=pathlib.Path('/tmp/federal-atlas-award-analysis')
def ready(r):
 raw=subprocess.check_output(['curl','-fsSL','--max-time','35',r['status_url']]);s=json.loads(raw);return s
jobs=[json.loads(p.read_text()) for p in CACHE.glob('request-*.json')]
for r in jobs:
 try:print(r['analysis_year'],r['analysis_kind'],json.dumps(ready(r))[:1800],flush=True)
 except Exception as e:print(type(e).__name__,str(e)[:120],flush=True)
