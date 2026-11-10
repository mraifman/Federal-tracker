#!/usr/bin/env python3
"""Rebuild every source award archive with verified recipient-code classification.

Uses the current official catalog; obsolete monthly URLs cannot be assumed to
remain available. Downloads one archive at a time into a bounded disk cache,
validates every byte range, hashes the entire ZIP and parses its complete CSVs.
Outputs remain separate from published data until validation and promotion.
Requires pyarrow and duckdb. Run with an execution environment that has network.
"""
import concurrent.futures,hashlib,json,os,pathlib,re,time,urllib.request,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
CACHE=pathlib.Path('/tmp/federal-atlas-sector-rebuild/archives')
STAGE=pathlib.Path('/tmp/federal-atlas-sector-rebuild/stage')
OUT=pathlib.Path('/tmp/federal-atlas-sector-rebuild/published')
CHUNK=8*1024*1024

def request(url,body=None,headers=None):
    return urllib.request.urlopen(urllib.request.Request(url,data=None if body is None else json.dumps(body).encode(),headers={'User-Agent':'FederalAtlasResearch/1.0','Content-Type':'application/json',**(headers or {})}),timeout=60)

def download(row):
    path=CACHE/row['file_name'];done=path.with_suffix('.verified.json')
    if done.exists() and path.exists():return path
    resume=path.exists() and path.stat().st_size==row['bytes']
    fd=os.open(path,os.O_CREAT|os.O_RDWR,0o600);os.ftruncate(fd,row['bytes'])
    checkpoint=path.with_suffix('.ranges.json');completed=set(json.loads(checkpoint.read_text())) if checkpoint.exists() and resume else set()
    def part(index):
        start=index*CHUNK;end=min(row['bytes'],start+CHUNK)-1
        for attempt in range(4):
            try:
                with request(row['url'],headers={'Range':f'bytes={start}-{end}'}) as res:
                    assert res.status==206 and res.headers.get('Content-Range')==f'bytes {start}-{end}/{row["bytes"]}'
                    data=res.read()
                assert len(data)==end-start+1
                assert os.pwrite(fd,data,start)==len(data)
                return index
            except Exception:
                if attempt==3:raise
                time.sleep(2**attempt)
    count=(row['bytes']+CHUNK-1)//CHUNK
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            pending=[pool.submit(part,i) for i in range(count) if i not in completed]
            for future in concurrent.futures.as_completed(pending):
                completed.add(future.result());checkpoint.write_text(json.dumps(sorted(completed)))
                if len(completed)%25==0:print(f'{row["file_name"]}: {len(completed)}/{count} verified ranges',flush=True)
    finally:os.close(fd)
    assert len(completed)==count
    with zipfile.ZipFile(path) as z:assert z.namelist()
    h=hashlib.sha256()
    with path.open('rb') as source:
        while data:=source.read(CHUNK):h.update(data)
    done.write_text(json.dumps({'bytes':path.stat().st_size,'sha256':h.hexdigest()}))
    return path

def main():
    for path in [CACHE,STAGE,OUT/'data']:path.mkdir(parents=True,exist_ok=True)
    manifest_path=CACHE/'manifest.json'
    if manifest_path.exists():manifest=json.loads(manifest_path.read_text())
    else:
        manifest=[]
        for year in [2024,2026]:
            for kind in ['assistance','contracts']:
                with request('https://api.usaspending.gov/api/v2/bulk_download/list_monthly_files/',{'fiscal_year':year,'agency':'all','type':kind}) as res:catalog=json.load(res)
                row=next(r for r in catalog['monthly_files'] if r['fiscal_year']==year)
                with request(row['url'],headers={'Range':'bytes=0-0'}) as res:
                    assert res.status==206
                    row['bytes']=int(res.headers['Content-Range'].split('/')[-1])
                    assert res.read()==b'P'
                manifest.append(row)
        assert len({r['updated_date'] for r in manifest})==1,'Archive vintages must match'
        manifest_path.write_text(json.dumps(manifest,indent=2))
    os.environ.update(ATLAS_AWARD_CACHE=str(CACHE),ATLAS_AWARD_STAGE=str(STAGE),ATLAS_AWARD_OUTPUT_ROOT=str(OUT))
    import analyze_external_awards as analyzer
    receipts=[]
    for row in manifest:
        receipt=STAGE/(row['file_name']+'.receipt.json')
        if receipt.exists() and json.loads(receipt.read_text()).get('recipient_sector_version')==analyzer.SECTOR_VERSION and len(list(STAGE.glob(f'{row["fiscal_year"]}-{row["type"]}-*.parquet')))==json.loads(receipt.read_text())['stage_chunks']:
            receipts.append(json.loads(receipt.read_text()));continue
        archive=download(row);receipts.append(analyzer.parse_archive(row))
        assert receipts[-1]['sha256']==json.loads(archive.with_suffix('.verified.json').read_text())['sha256']
        # The complete source hash and row counts are retained; free the large ZIP.
        archive.unlink();print('Source parsed and hashed; released ZIP disk space.',flush=True)
    analyzer.export_all(receipts)
    print('Rebuilt outputs ready for independent validation:',OUT,flush=True)
if __name__=='__main__':main()
