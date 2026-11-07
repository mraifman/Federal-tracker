#!/usr/bin/env python3
"""Retrieve all USAspending top-tier agencies. Never synthesize missing data."""
import datetime as dt
import json
import pathlib
import urllib.request

URL = "https://api.usaspending.gov/api/v2/references/toptier_agencies/"
OUT = pathlib.Path(__file__).resolve().parents[1] / "data" / "agencies.json"

def main():
    req = urllib.request.Request(URL, headers={"User-Agent": "FederalAtlas/0.1 (public federal-data research)", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as response:
        payload = json.load(response)
    if isinstance(payload, list):
        rows = payload
    elif isinstance(payload, dict):
        rows = next((payload[k] for k in ("results", "agencies", "data") if isinstance(payload.get(k), list)), None)
    else:
        rows = None
    if not rows or len(rows) < 10:
        raise RuntimeError("Unexpected/empty agency response; refusing to publish")
    cleaned = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        name = row.get("agency_name") or row.get("name")
        code = row.get("toptier_code") or row.get("agency_code") or row.get("code")
        if name and code is not None:
            cleaned.append({"name": str(name), "code": str(code), "raw": row})
    if len(cleaned) < 10:
        raise RuntimeError("Unable to identify agency names/codes; refusing to publish")
    cleaned.sort(key=lambda r: r["name"].lower())
    result = {"source": URL, "retrieved_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(), "coverage": "USAspending top-tier agencies; not all federal entities", "count": len(cleaned), "agencies": cleaned}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    print("Wrote", len(cleaned), "official agency records")

if __name__ == "__main__":
    main()
