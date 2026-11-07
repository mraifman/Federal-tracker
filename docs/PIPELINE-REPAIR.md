# Pipeline investigation, November 7, 2026

The repository initially contained one HTML page, two ingestion scripts, one refresh workflow, and no committed datasets.

## Evidence from GitHub

- [Run 42402193590](https://github.com/mraifman/Federal-tracker/actions/runs/42402193590) failed workflow validation without creating a job. GitHub's run page reports: “You have an error in your yaml syntax on line 17.” The affected workflow used literal `\n` characters after `run: |` instead of a multiline block.
- [Sequential run 42403200815](https://github.com/mraifman/Federal-tracker/actions/runs/42403200815) logged 111 directory records at 18:49:44 UTC, but no award results or commit before cancellation at 19:08:43 UTC.
- [Concurrent run 42404127798](https://github.com/mraifman/Federal-tracker/actions/runs/42404127798) logged 111 directory records at 19:01:13 UTC, but no award results or commit before cancellation at 19:08:45 UTC. This investigation canceled that run and the two older overlapping runs to prevent stale publication. Their logs show no award traceback; they do not establish a remote API failure or a successful concurrency fix.

## Reproduced defects and fixes

The award endpoint and explicit `agency_type=funding` parameter match Treasury's API contract. Direct requests returned valid federal observations. The old retry loop used `range(2)` but tested `attempt == 2`, silently returning `None` after exhausted retries. The corrected code raises the original failure, immediately records permanent HTTP errors, validates response agency/year and finite numeric values, and logs progress.

FY2027 requests returned HTTP 400 with “Value for fiscal_year is outside the range of current submissions.” The directory currently reports FY2026, so ingestion uses reported coverage rather than assuming the current calendar date implies data availability. FY2024–2026 yielded 333 verified observations across 111 agencies locally, with no missing observations. Four-digit agency codes are preserved.

The refresh now retains daily snapshots and validates coverage before committing. Explicit Pages artifact deployment avoids relying on a bot commit to trigger branch-based Pages builds. [Deployment 42404964424](https://github.com/mraifman/Federal-tracker/actions/runs/42404964424) succeeded, including validation, upload, and deployment, without changing the Pages source setting. The current integration lacks permission to change that setting (HTTP 403), but that permission is unnecessary for this successful deployment.

## Checks

Four ingestion tests cover exhausted retries, permanent HTTP errors, mismatched identities/nonfinite values, and valid zeros. Dataset validation checks coverage, counts, source requests, and response values. `tests/browser.cjs` exercises top 35/all agencies, Treasury search, agency history, year filtering, JavaScript errors, and horizontal overflow at 1440px and 390px. Run it against a local server or pass the live URL, with Playwright and Chromium available.
