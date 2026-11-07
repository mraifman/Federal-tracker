# Federal Atlas

An evidence-first atlas of federal government changes since January 20, 2025.

## Current coverage

The live view covers **USAspending top-tier reporting agencies**, not every federal entity. Funding-agency award obligations are available from FY2024 (a pre-inauguration reference year) through the latest fiscal year represented in the agency directory. These are award transaction obligations, not appropriations, account obligations, outlays, workforce counts, or evidence of cancellation. Fiscal years do not align with presidential terms. Current fiscal years are partial and prior years can be revised.

The federal directory determines coverage; agencies are never selected by hand. A missing agency-year observation is absent and reported in `errors`, never converted to zero. An API-reported zero remains zero. Each observation links to its exact federal API request and retains latest action date, reporting period, transaction count, and source warnings. Latest action date is not a guarantee of complete reporting.

The Agency directory view separately exposes all records in the official Federal Register agency directory, including historical entities and subagencies, and reproduces its parent-child hierarchy. This directory broadens discoverability beyond USAspending but is not a complete current organizational census. No automatic name matching, operating-status classification, or financial crosswalk is inferred. The full federal source payload is preserved, with retrieval timestamps and daily snapshots.

## Reproduce

Requires Python 3.12 with no third-party Python dependencies:

```sh
python scripts/refresh_agencies.py
python -u scripts/refresh_awards.py
python scripts/refresh_entities.py
python scripts/validate_data.py
python -m unittest discover -s scripts -p 'test_*.py'
python -m http.server 8000
```

The award endpoint contract is maintained by Treasury at https://github.com/fedspendingtransparency/usaspending-api/blob/master/usaspending_api/api_contracts/contracts/v2/agency/toptier_code/awards.md. Requests explicitly use `agency_type=funding`; the default is awarding and produces different values.

A refresh requires valid numeric observations for at least 95% of directory agency-year combinations. A failed refresh leaves the previous award dataset intact and fails the workflow. The directory and award files are committed together only after validation. UTC retrieval timestamps appear in each dataset. `data/snapshots/YYYY-MM-DD/` preserves daily observations; repeated refreshes on the same date replace that day's snapshot, with earlier revisions retained in Git history.

## Automation and publication

The daily refresh at 12:17 UTC validates, commits data and snapshots, then explicitly uploads and deploys a Pages artifact. An independent Pages workflow deploys site/data pushes. Explicit deployment is necessary because commits using `GITHUB_TOKEN` do not trigger branch-based Pages builds. The explicit artifact deployment was verified with this repository’s existing Pages configuration; changing the build-source setting was unnecessary. Failed retrieval or validation prevents deployment. Six concurrent requests and bounded retries limit API load; permanent HTTP errors are recorded immediately.

## Remaining work

Comprehensive federal entity coverage requires a broader official entity inventory and explicit reconciliation of entities absent from USAspending. Workforce, account/program/award drilldowns, program cancellation evidence, oversight records, and legally grounded reconstruction requirements remain unimplemented. No restoration costs or program statuses are inferred from funding changes. Future sources need their own reproducible pipelines, period definitions, raw evidence, and coverage validation before their views are enabled.
