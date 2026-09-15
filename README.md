# Nimbus Trust Center: continuous assurance for a simulated company

_Live at **https://nimbus-trust-center.vercel.app** · Privately built for demonstration and portfolio purposes only · v1.0.0_

**Nimbus** is a fictional work-management SaaS company. This site is its trust center and, behind it, the governance, risk, and compliance control room that a small company would run in 2026: one control library crosswalked to four frameworks, an AI system inventory with runtime permissions and a kill switch, a daily evidence job, a risk register with one quantified scenario, a vendor register, and a board brief. The AI assistants it governs are real (the sister demo, Nimbus AI Assistants); the company is simulated, and every card says which is which.

Built AI-assisted; every control mapping, check, and number was specified, tested, and can be walked through under questioning. The **Tested** tab lists what broke and how each item is guarded.

## What a reviewer should look at first

1. The Trust Center (`/#trust`): ten seconds, plain language, real-versus-simulated labels.
2. Controls (`/#controls`): paste a security questionnaire question into the mapper, then open a control and switch the header to **Technical** for the crosswalk, test procedure, and raw evidence.
3. AI Systems (`/#ai`): the runtime permission tables. What each assistant may do, the guard on each action, who approves, and how it is switched off.
4. Evidence (`/#evidence`): the daily bundle, freshness per control, and drift since the previous run.
5. Board Brief (`/#board`): two pages in board language, generated from the same data.

## What is true, precisely

- **Real:** the three Nimbus assistants and this site's control mapper, with their caps, limiter, disclosure rules, kill switch procedure, and no-transcript design; Google, Vercel, and GitHub as vendors with public trust centers; the evidence job, its bundles, and every check result; the build, the gates, the crosswalk logic, the hash-pinned CSP, the security.txt. 20 of the 54 controls are real.
- **Simulated:** Nimbus as a company (about 180 employees in Texas), its roles, policies, SOC 2 status, PCI attestation, four of seven vendors and all contract clauses, attestation dates for manual controls, risk ratings, and scenario inputs.
- **Limits:** single maintainer (review is the author with AI assistance plus the gates); the limiter is per warm serverless instance; the mapper's keyword accuracy is measured in-sample; no integration with cloud APIs, an identity provider, device management, or ticketing. Those are named on the site, not faked.

## Frameworks and drivers

NIST CSF 2.0 (all six functions, Govern included), CIS Controls v8.1 with IG flags, SOC 2 Trust Services Criteria, and NIST AI RMF 1.0 form the crosswalk. Legal and contractual drivers appear as columns: Texas SB 2610 (cybersecurity safe harbor, effective September 1, 2025), Texas HB 149 (TRAIGA, effective January 1, 2026, NIST AI RMF alignment as an affirmative defense), Texas breach notification windows, PCI DSS SAQ A, GDPR, HIPAA business associate agreements, and the EU AI Act with the dates as amended by the 2026 Digital Omnibus (Article 50 transparency from August 2, 2026; Annex III high-risk deferred to December 2, 2027).

## How it is built

- `data/*.json` and `policies/*.md` are the single source. `node build.mjs` validates them (schema, every cross-reference, framework IDs, expired exceptions, AI inventory completeness, dash characters, city leak, attribution count) and assembles `backend/index.html` and `backend/vercel.json` with a Content-Security-Policy that pins the SHA-256 of each inline script and of the stylesheet. Generated files are never hand-edited. The build is deterministic.
- `backend/api/map.js`: the control mapper. Keyword shortlist (BM25 with a synonym map, `backend/lib/rank.mjs`), model choice restricted to the shortlist, server-side validation of every returned id, keyword fallback when there is no key or the provider fails, fair-use limiter keyed on the platform client IP, input cap, POST only, same-origin CORS, fixed error copy, nothing stored. `backend/api/health.js`: token-free probe that drives the status pill and proves the kill switch state.
- `eval/evidence-collect.mjs`: the daily job. Transport and browser hardening headers on the live sites, security.txt, dependency audit, gate results, secret scan, policy and exception freshness, AI inventory completeness, risk and vendor register checks. Writes `evidence/<date>.json` and `evidence/latest.json`, rebuilds the page, and `.github/workflows/evidence.yml` commits with `[skip ci]`.
- Provider-flexible by environment variable (`PROVIDER`, `API_KEY`, `CHAT_MODEL`); currently Google Gemini 2.5 Flash with reasoning disabled. Deploy root is `backend/`; see `GO-LIVE.md`.
- Zero runtime dependencies. Dev dependencies: jsdom (UI gate) and, optionally, Playwright (screenshots under the deploy CSP).

## Tests and gates

`npm test` runs the eval, the build, and three gates:

| Gate | What it asserts |
|---|---|
| `test/gate-static.mjs` | no em or en dashes anywhere; attribution exactly once and never in data; forbidden strings (private list, gitignored) absent from files and git history; city confined to the data file; deterministic rebuild; CSP hashes match the built scripts and stylesheet; security headers configured; no inline style attributes; version stamps consistent; OG tags and og-image; security.txt valid; https everywhere; every fixed finding names a gate; every automated control has a check in the latest bundle; gold set integrity; evidence workflow uses [skip ci] |
| `test/gate-endpoint.mjs` | the real handlers over HTTP with the provider mocked: 405 and 400 paths, input cap, keyword path, limiter keyed on the platform IP, rotating forwarding headers share one bucket, CORS allow list, model output validation (unknown ids dropped, extra fields dropped, rationale capped, confidence normalized, fenced JSON parsed, garbage falls back), untrusted-data wrapping in the prompt, at most eight candidates, provider failure and rate limit handling with no provider text, health probe shape |
| `test/gate-ui.mjs` | the built page in a DOM: every view renders, filters and crosswalk mode, deep links open drawers, Escape closes, reader and theme toggles persist, in-page mapper fallback returns real ids, heat map and register, deterministic scenario, board brief content and print, evidence table, glossary search, no city, no dashes, attribution once |
| `eval/run.mjs` | mapper gold-set accuracy (50 questions) on the keyword path, floor top-3 0.6; `npm run eval:live` measures the model path against the deployed endpoint |

`npm run shots` renders every view in headless Chromium under the deploy headers and fails on any console error or CSP violation (needs Playwright).

## API

- `POST /api/map` with `{ "q": "one questionnaire question" }` returns `{ method, model, proposals: [{ id, title, rationale, confidence }], shortlist, truncated, note }`. 20 requests per 5 minutes per visitor, 600 per day per instance, 600 characters.
- `GET /api/health` returns `{ ok, version, provider, model, mapper, limits }`.

## Responsible disclosure

Report a vulnerability through the security advisory form on this repository (linked from `/.well-known/security.txt`). Please do not test the fair-use limits with automated traffic; the endpoint calls a paid model and the daily cap is there to protect a portfolio budget.

## Folder map

`backend/` (deploy root: page, api, lib, site.json, og-image, favicon, llms.txt, robots.txt, .well-known) · `src/` (page template and script) · `data/` (controls, frameworks, AI systems, risks, scenario, vendors, exceptions, glossary, company, findings) · `policies/` · `evidence/` (bundles) · `eval/` (gold set, runner, evidence collector, results) · `test/` (gates and harness) · `tools/` (og-image, screenshots, overflow check) · `docs/` (data model, crosswalk, interview explainer) · `build.mjs`, `GO-LIVE.md`, `CHANGELOG.md`.

## Sister project

Nimbus AI Assistants (Grounded): the retrieval-grounded support and sales assistants this site governs, with their own 24-finding register. Linked from the site footer.

> Nimbus is fictional; all company data is illustrative. Please do not enter real personal, customer, or payment information.
