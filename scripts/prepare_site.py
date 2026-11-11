#!/usr/bin/env python3
"""Build one Pages bundle for both deployment workflows and verify its assets."""
import argparse,pathlib,shutil
from html.parser import HTMLParser
from urllib.parse import urlsplit
ROOT=pathlib.Path(__file__).resolve().parents[1]
class Assets(HTMLParser):
 def __init__(self):super().__init__();self.paths=set()
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs);value=attrs.get('src') if tag=='script' else attrs.get('href') if tag=='link' else None
  if value:
   url=urlsplit(value)
   if not url.scheme and not url.netloc and url.path:self.paths.add(url.path)
def prepare(output):
 output.mkdir(parents=True,exist_ok=True)
 for folder in ['data','vendor']:shutil.copytree(ROOT/folder,output/folder,dirs_exist_ok=True)
 for path in ROOT.iterdir():
  if path.is_file() and path.suffix in {'.html','.css','.js','.svg','.png','.jpg','.jpeg','.webp'}:shutil.copy2(path,output/path.name)
 if not (output/'social-preview.png').is_file():raise SystemExit('Site bundle is missing the social preview image')
 parser=Assets();parser.feed((output/'index.html').read_text())
 missing=[name for name in sorted(parser.paths) if not (output/name).is_file() or not (ROOT/name).is_file()]
 if missing:raise SystemExit('Site bundle is missing referenced assets: '+', '.join(missing))
 print(f'Prepared {output}; all {len(parser.paths)} entry-page assets exist, including recipient details and transitions.')
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--output',type=pathlib.Path,default=ROOT/'_site');prepare(parser.parse_args().output)
