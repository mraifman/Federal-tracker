#!/usr/bin/env python3
"""Official USAspending FY2024-FY2026 agency award obligations; no estimated values."""
import datetime as dt
import json
import pathlib
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = "https://api.usaspending.gov"

def get(path, params=None):
    url = BASE + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent":"FederalAtlasResearch/0.1","Accept":"application/json"})
            with urllib.request.urlopen(req, timeout=45) as res:
                return json.load(res)
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)

def main():
    inventory = get("/api/v2/references/toptier_agencies/")
    if isinstance(inventory, list):
        agencies = inventory
    else:
        agencies = inventory.get("results", inventory.get("agencies", []))
    if not isinstance(agencies, list) or len(agencies) < 10:
        raise RuntimeError("Agency directory missing or malformed")
    records = []
    failures = []
    for a in agencies:
        name = a.get("agency_name") or a.get("name")
        code = a.get("toptier_code") or a.get("agency_code") or a.get("code")
        if not name or code is None:
            continue
        code = str(code).zfill(3)
        years = {}
        for year in (2024, 2025, 2026):
            path = f"/api/v2/agency/{code}/awards/"
            try:
                d = get(path, {"fiscal_year":year, "agency_type":"funding"})
                value = d.get("obligations")
                if not isinstance(value, (int,float)) or isinstance(value, bool):
                    raise ValueError("No numeric obligations")
                years[str(year)] = {"obligations":value, "transactions":d.get("transaction_count"), "source":BASE + path + "?fiscal_year=" + str(year) + "&agency_type=funding"}
            except Exception as exc:
                failures.append({"agency":code,"year":year,"error":str(exc)[:120]})
        records.append({"code":code,"name":name,"years":years})
    if len(records) < 10 or sum(bool(r["years"]) for r in records) < 10:
        raise RuntimeError("Insufficient verified data; refusing to publish")
    result = {
      "source":"USAspending.gov official agency award obligations API",
      "retrieved_at_utc":dt.datetime.now(dt.timezone.utc).isoformat(),
      "definition":"Funding-agency award obligations by fiscal year. NOT total appropriations, total spending, outlays or program cancellations.",
      "comparability":"FY2024, FY2025 and FY2026 are full fiscal years; FY2026 reporting may still be revised. Missing records are null, never zero.",
      "agencies":sorted(records,key=lambda a:a["name"].lower()),
      "errors":failures
    }
    out=ROOT/"data"/"agency-awards.json"
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n")
    print("Published",len(records),"agencies;",len(failures),"missing agency-year observations")

if __name__=="__main__":
    main()
