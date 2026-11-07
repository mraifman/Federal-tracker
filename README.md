# Federal Atlas

A focused comparison of the reported federal civilian workforce before Biden left office and the latest OPM snapshot. The interface uses workforce spotlights, a source-based trend chart, agency filters, subagency detail, a searchable table and CSV export. Original typography and colors accompany a layout inspired by Dezernat Zukunft’s budget tracker.

## Current comparison

- **Baseline:** December 31, 2024, the last OPM month-end snapshot before January 19, 2025. This is not an exact inauguration-day count.
- **Latest:** September 30, 2026, checked November 7, 2026. August remains selectable. September has approximately 10,000 missing defense Status records; a non-defense scope is available.
- **Metric:** OPM EHRI employment counts, all work schedules, including pay and non-pay status. These are not effective FTEs, layoffs, vacancies, or service-capacity estimates. USPS, several intelligence bodies, military personnel and other excluded populations are outside the coverage.
- **Totals:** 2,312,301 baseline records versus 2,017,021 latest records; the reported difference of −295,280 includes reporting omissions. Missing agency observations are never assigned zero in agency comparisons.

`index.html`, `workforce.js` and `workforce.css` form the active buildless site. `data/workforce-changes.json` retains department, subagency and occupation aggregates for nine snapshots, versioned OPM source URLs and SHA-256 hashes. Individual employee files are not published. Other retained research assets are inactive in the simplified interface.

## Sources

[OPM downloads](https://data.opm.gov/get-data/data-downloads) · [Coverage](https://data.opm.gov/resources/data-sources) · [Release notes](https://data.opm.gov/info-and-help/release-notes) · [API](https://data.opm.gov/get-data/api-access)

## Run and validate

Serve the repository with `python3 -m http.server 8000`. Run `node --check workforce.js`, `python3 scripts/validate_data.py`, and `python3 scripts/validate_change_data.py`. Browser interactions were verified through the Codex browser on desktop and mobile; `tests/browser.cjs` records corresponding regression checks for environments with Playwright installed.

Rebuild OPM aggregates using `scripts/download_workforce.py` followed by `scripts/build_change_data.py` with the complete manifest. Preserve the pinned versions and all retained snapshots. The broader research data validators also verify historical OMB, fiscal execution and grant-register source provenance.

GitHub Pages deploys from `main` via `.github/workflows/pages.yml`. Public URL: https://mraifman.github.io/Federal-tracker/
