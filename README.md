# Blue Hour Project

An interactive comparison of federal people, funding by purpose, spending uses, and resources awarded to outside parties. The site is published from this repository to [GitHub Pages](https://mraifman.github.io/Federal-tracker/).

## Comparisons and definitions

- **People:** December 31, 2024 (last OPM month-end snapshot before Biden’s final full day, January 19, 2025) versus September 30, 2026. August is selectable. Non-defense is the default; defense civilian reporting is incomplete in September. These are headcounts including pay and non-pay status, not effective FTE, layoffs, vacancies or service capacity.
- **Funding:** the topic analysis uses only discretionary SF133 lines (4070 net authority, 4000 gross authority, 1160 appropriations, 4080 net outlays), retaining mixed accounts’ reported discretionary portions. Missing lines remain unavailable; mandatory-inclusive values are never substituted. The underlying full-scope dataset is preserved for agency spending. Sources: actual FY2024 versus FY2026 OMB SF 133 execution reports, all 58 published agency workbooks. These show enacted and adjusted resources, rather than presidential requests. Account sums are not consolidated federal totals. Official purpose classifications span agencies; mixed/unmatched accounts remain flagged rather than assigned invented shares.
- **Uses:** matched October–August account obligations in FY2024/FY2026, paired responses for 110 of 111 USAspending directory agencies. NIH has its own official account portfolio. Dollar-scaled composition bars show totals as well as shares.
- **External awards:** the interactive views exclude identified mandatory benefit programs using `data/mandatory-benefit-programs.json`; this is not a complete discretionary classification. The same policy applies to totals, flows, programs, recipients and exports; the complete source aggregates are retained for audit. Sources: full FY2024/FY2026 transaction archives for all agencies, assistance and contracts, archive vintage November 6, 2026. Transaction obligations are aggregated, never repeated lifetime award ceilings. Loan subsidy cost and face value remain distinct. Funding and awarding agency views are alternatives, not additive totals. Recipient sectors use reported classifications; unresolved account-purpose allocations remain explicit. Program/recipient detail retains negative adjustments. All reported organizational recipients are retained separately in compact sector/agency-role files loaded on demand. There is no combined Other recipients remainder; source-reported aggregate identities remain as reported. Individuals are aggregated without names. Prime award archives do not constitute a complete ultimate-beneficiary or subaward ledger.

## Interactions

Workforce bubbles reform in place from agencies to subagencies, then occupational series at the source’s organizational limit. Occupational series are actual reported roles, **not** invented office allocations. Public OPM data does not expose NIH institute/center staffing; NIH-wide totals are not substituted for institute headcounts. Funding bubbles drill through topic → agency → bureau → account. Familiar agency acronyms and policy-area names appear inside bubbles; full titles and exact figures appear in navy hover/focus tooltips and the summary ledger. Technical source identifiers remain in the source records and exports. Bubble positions arrange the plot only, without geographic or semantic claims. Crowded charts show the largest changes with all matching records retained in tables/exports.

The agency spending view connects grants/fixed charges to named assistance programs and outside recipients. Sector selection opens recipient companies and organizations; program/purpose views remain available in the sidebar, with topic filters, funding/awarding perspectives and CSV export. Account-spending and award periods/scopes differ and are explicitly labeled.

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

Run `python scripts/validate_legal_review.py`, `node tests/legal-review.cjs` and `python -m unittest discover -s scripts -p 'test_*.py'`. Sources, case histories and methodological notes are organized in the About the Evidence view, with expanded sections for People, Funding Priorities and Money Flows.

## Interface

The main page uses an original research-led design informed by [Meta-Moment](https://meta-moment.researchonresearch.org/topics): a navy data hero, slab-serif headings, short chart introductions, white research panels, and a dedicated About the Evidence view. Roboto and Roboto Slab are self-hosted with their licenses in `vendor/fonts/`; no external font service is required at runtime.

The opening map reads the published OPM department records directly. Each point has a fixed data position: percentage headcount change on the horizontal axis and December 2024 headcount on a logarithmic vertical axis. Defense is excluded, and points require both observations plus a positive baseline. The map's net-change summary uses the same reported non-defense population as the workforce view; it is not a layoff count. The opening summary reports the net change in non-defense headcount; technical agency and account coverage counts are kept out of the headline.

Workforce and funding charts offer **Bubbles** and **Ranked changes** over the same bound chart records. Mobile starts with ranked changes, initially showing 12 rows with a control to show the complete plotted subset. The existing full tables and exports retain all matching records. The display choice survives drilldowns, and source tables expand in place. Bubble colors can distinguish agencies/source units or direction of change; the color key is explicit. A colored side ledger links the largest plotted units to the same drilldowns. Tooltips expose exact values and dates on hover or keyboard focus and close with Escape. Chart-only CSV exports identify their subset and units. Normal wheel scrolling passes through bubble charts; Ctrl/Command-scroll zooms, dragging pans, and double-click resets the allocation plot.

`atlas.css` supplies the design; `atlas-experience.js` draws the source-bound hero; `atlas-chart-tools.js` supplies shared chart controls. Both deployment workflows include these files, the icon and self-hosted fonts. Existing source datasets, ingestion, financial calculations, benefit exclusions and legal review are unchanged by the redesign.

Browser verification (requires Playwright and Chromium):

```sh
node tests/redesign.cjs http://127.0.0.1:8000/
node tests/browser.cjs http://127.0.0.1:8000/
```

The redesign suite checks desktop and mobile source figures, hero coverage, chart modes, workforce/occupation drilldowns, search and periods, CSV contents, funding/account drilldowns, money-flow selection, recipients, organized evidence, missing assets, JavaScript errors and page overflow. Set `CHROMIUM_PATH` if Chromium is installed at another path. Pass the published site URL to run the same suite against production.


## Recipient-sector correction (November 2026)

The former assistance classifier searched the text of recipient descriptions. It incorrectly matched “higher education” inside the definition of a nonprofit that is **other than** an institution of higher education. This affected government-wide sector totals, not just GGRF. It did not establish that these programs funded academia.

Assistance now uses explicit `business_types_code` flags, with the federal mapping pinned in `data/recipient-sector-rules.json` and its source SQL preserved under `data/raw/`. H/O/S/T/U/V and legacy 06/20 identify higher education; M/N/12 identify nonprofits. Concatenated codes retain the documented precedence: any individual flag wins for privacy, then explicit higher education, nonprofit, public-body and private-sector flags. Unmapped types stay unknown. Recipient groups describe the prime recipient, not program purpose or ultimate beneficiaries. Contract groups continue to use reported organization-type boolean flags.

All four FY2024/FY2026 source archives were rebuilt from the same November 6, 2026 release, rather than mixing the retired October URLs with current files. This refresh can change amounts as well as classifications. `data/recipient-sector-audit.json` compares the old and new classification rules **on the same November transactions**, retaining code/description pairs, transaction counts, net obligations, source receipts and reviewed GGRF examples. A lack of FY2026 transactions is not proof of termination or inaccessible funds.

To reproduce the complete award rebuild in a Python environment with PyArrow and DuckDB:

```sh
python scripts/rebuild_award_sectors.py
```

The command retrieves the current federal archive catalog, requires one consistent release for both years and award types, checks all download ranges, ZIP contents, source hashes, transaction identities and counts, and builds outputs under `/tmp/federal-atlas-sector-rebuild/published/`. It does not overwrite the live datasets. Validate and promote the full output set together; the usual allocation and legal-review checks still apply. Cached normalized stages must match the current classifier version and complete receipt counts.

`python -m unittest discover -s scripts -p 'test_*.py'` tests recipient-code behavior without third-party dependencies. `node tests/recipient-sectors.cjs` checks the published GGRF records and sector filters; deployment runs this regression alongside financial reconciliation. Funding and awarding roles are tested separately and are never added together.

The Blue Hour Project header gives the opening chart two-thirds of the desktop hero, uses larger interface and explanatory text, and stacks the chart below the introduction on phones. Agency labels use the official USAspending abbreviations matched through the existing workforce crosswalk; funding labels use the policy-area names, with original source codes retained in data and exports.

Recipient chart rows open an on-demand USAspending transaction lookup (`award-detail.js`). It keeps archive totals separate from live API records, checks recipient identity, shows individual award links and action amounts, and claims reconciliation only when all pages and known amounts match both archived fiscal-year totals. The exact request, retrieval date and source aggregate are recorded on About the Evidence; the dialog can export the complete evidence JSON.

Money Flows also offers **Agency changes** in the Show filter. Agency comparisons use the same benefit exclusions as recipient totals; selecting an agency leads to sectors, named recipients, programs and individual official awards. Compact drawer amounts are display rounding only; evidence JSON retains exact source values. Award descriptions use short sentence-case summaries with full source descriptions available below.

## Recipient identity and source groups

Named-recipient rankings exclude redacted names, source-reported aggregates, privacy-grouped individuals, and records without an established recipient identifier. These records remain in scope totals, source datasets, exports, and a separate expandable source-groups section. A blank identifier is grouped by its reported label instead of merging every blank identifier into one purported organization. Neither a repeated placeholder nor a source-sector label establishes that a reporting group is a single company.

Source-group details show archived totals by program/purpose and award/accounting type, and do not make recipient-specific API searches or attribute individual awards to unidentified recipients. Differences are changes in reported group totals, not company growth. Negative obligations on non-loan awards reflect net reductions to prior commitments; negative loan subsidy costs use credit accounting and are not cash payments. Exact transaction-level causes require additional source evidence.

Run `node tests/recipient-identities.cjs` to check placeholder separation, named-recipient classification, and preservation of both fiscal-year totals and negative amounts.
