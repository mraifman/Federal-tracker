# Progress 2028

An interactive comparison of federal people, funding by purpose, spending uses, and resources awarded to outside parties. The site is published from this repository to [GitHub Pages](https://mraifman.github.io/Federal-tracker/).

## Comparisons and definitions

- **People:** December 31, 2024 (last OPM month-end snapshot before Biden’s final full day, January 19, 2025) versus September 30, 2026. August is selectable. Non-defense is the default; defense civilian reporting is incomplete in September. These are headcounts including pay and non-pay status, not effective FTE, layoffs, vacancies or service capacity.
- **Funding:** the topic analysis uses only discretionary SF133 lines (4070 net authority, 4000 gross authority, 1160 appropriations, 4080 net outlays), retaining mixed accounts’ reported discretionary portions. Missing lines remain unavailable; mandatory-inclusive values are never substituted. The underlying full-scope dataset is preserved for agency spending. Sources: actual FY2024 versus FY2026 OMB SF 133 execution reports, all 58 published agency workbooks. These show enacted and adjusted resources, rather than presidential requests. Account sums are not consolidated federal totals. Official purpose classifications span agencies; mixed/unmatched accounts remain flagged rather than assigned invented shares.
- **Uses:** matched October–August account obligations in FY2024/FY2026, paired responses for 110 of 111 USAspending directory agencies. NIH has its own official account portfolio. Dollar-scaled composition bars show totals as well as shares.
- **External awards:** the interactive views exclude identified mandatory benefit programs using `data/mandatory-benefit-programs.json`; this is not a complete discretionary classification. The same policy applies to totals, flows, programs, recipients and exports; the complete source aggregates are retained for audit. Sources: full FY2024/FY2026 transaction archives for all agencies, assistance and contracts, archive vintage October 6, 2026. Transaction obligations are aggregated, never repeated lifetime award ceilings. Loan subsidy cost and face value remain distinct. Funding and awarding agency views are alternatives, not additive totals. Recipient sectors use reported classifications; unresolved account-purpose allocations remain explicit. Program/recipient detail retains negative adjustments. Ten largest recipient amounts per program/year/agency role are named; all remaining dollars are preserved as Other recipients. Individuals are aggregated without names. Prime award archives do not constitute a complete ultimate-beneficiary or subaward ledger.

## Interactions

Workforce bubbles reform in place from agencies to subagencies, then occupational series at the source’s organizational limit. Occupational series are actual reported roles, **not** invented office allocations. Public OPM data does not expose NIH institute/center staffing; NIH-wide totals are not substituted for institute headcounts. Funding bubbles drill through topic → agency → bureau → account. Titles use external callouts, measured wrapping and spaced label rails. Crowded charts show the largest changes with all matching records retained in tables/exports.

The agency spending view connects grants/fixed charges to named assistance programs and outside recipients. External allocation bubbles drill sector → program/purpose → recipient, with topic filters, funding/awarding perspectives and CSV export. Account-spending and award periods/scopes differ and are explicitly labeled.

Missing data is never evidence of cancellation. Reviewed cases distinguish statutory closure, zero new appropriations, spending from prior balances, account recoding and transferred operations. Source rows, URLs, hashes, derived values and reasons remain in the public datasets.

## Run locally

```sh
python3 -m http.server 8000
```

Open `http://127.0.0.1:8000/`. No build or runtime API key is required; D3 is vendored locally.

## Data pipeline and checks

- `scripts/build_workforce_roles.py`: occupational-series aggregates, reconciled to each organizational parent.
- `scripts/build_authority_comparison.py`, `scripts/classify_authority.py`, `scripts/audit_funding_availability.py`: SF133 ingestion, purpose crosswalks and strict zero-authority reconciliation.
- `scripts/build_spending_comparison.py`: matched-period account and object-class responses.
- `scripts/download_awards_ranged.py`, `scripts/analyze_external_awards.py`: validated full-archive downloads, streamed CSV normalization, transaction deduplication, public agency/program/recipient aggregates. Raw archives/staging stay in `/tmp`, outside Git. Requires Python with pyarrow and DuckDB.
- `scripts/validate_data.py`, `scripts/validate_change_data.py`, `scripts/validate_comparison.py`, `scripts/validate_allocations.py`: provenance, hierarchy, coverage, financial reconciliation and export checks.

GitHub Actions deploys validated static files. The scheduled legacy agency refresh does **not** automatically rebuild the large workforce, SF133 or full-archive analyses; those retain their explicit snapshot dates until rerun. Historical research assets are retained but are not loaded by the active interface.

## Court review

`data/legal-cases.json` stores manually reviewed court sources, dates, party identifiers and program scope. Program matches flag related litigation; only exact program-and-recipient matches identify a verified party link. These annotations never adjust financial figures or imply that funds are available.

`python scripts/build_legal_review.py` screens the complete displayed program set for large reductions, negative net obligations and missing-year transactions. It generates `data/legal-review-queue.json`; this is a review queue, not an automated litigation search. The daily refresh regenerates financial flags and overdue-review notices but never updates a case’s `checked_on` date or verifies a court finding. Reviewers must read new orders, stays and appeals and update sources and scope explicitly. A documented search with no case identified is distinct from a record not reviewed.

Run `python scripts/validate_legal_review.py`, `node tests/legal-review.cjs` and `python -m unittest discover -s scripts -p 'test_*.py'`. Sources, case histories and methodological notes are collected at the bottom of the main page.
