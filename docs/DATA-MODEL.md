# Data model (single source of truth for every view)

Every page view is a renderer over the JSON files in `data/`. `node build.mjs` validates them, resolves every cross-reference, computes derived metrics, and embeds them into `backend/index.html`. A broken reference fails the build.

Writing rules for every data file:
- No em dashes or en dashes anywhere (the static gate fails the build). Use commas, colons, or parentheses.
- Every record carries `reality`: `"real"` (exists and can be inspected) or `"simulated"` (invented for the story). When in doubt, `"simulated"`.
- Every record carries `plain`: one or two sentences a non-technical reader understands, no acronyms without a gloss.
- Nimbus is fictional. Never use real people's names. The only person name allowed anywhere in the repo is the attribution line in `backend/site.json`.
- The city is recorded in `company.json` only; visible text says "Texas" and only where a legal driver needs a jurisdiction.

## frameworks.json
```
{ "frameworks": { "<key>": { "name", "short", "version", "url", "plain", "kind": "framework|driver", "ids": { "<ID>": "<title>" } } } }
```
Keys used: `csf` (NIST CSF 2.0), `cis` (CIS Controls v8.1), `soc2` (SOC 2 TSC), `airmf` (NIST AI RMF 1.0). Drivers (legal or contractual, shown as columns, not frameworks): `sb2610`, `traiga`, `pci_saq_a`, `gdpr`, `hipaa_baa`, `eu_ai_act`, `tx_breach`.

## controls.json
```
{ "controls": [ {
  "id": "NC-GV-01",                 // NC-<CSF function>-<nn>
  "function": "GV|ID|PR|DE|RS|RC",
  "title": "...",
  "statement": "...",               // the control as written for auditors
  "plain": "...",                   // what it means for a non-technical reader
  "ai": true|false,                 // AI-specific control
  "owner_role": "...",              // role, never a person
  "frequency": "continuous|daily|weekly|monthly|quarterly|semiannual|annual|on-change",
  "test_procedure": "...",
  "evidence_type": "automated|attestation|document",
  "automation": "check.<id>" | null, // id of an evidence check that proves it
  "freshness_days": <n>,            // evidence older than this is stale
  "status": "operating|partial|planned",
  "mappings": { "csf": ["GV.OC-01"], "cis": [{"id":"1.1","ig":1}], "soc2": ["CC1.1"], "airmf": ["GOVERN 1.1"] },
  "drivers": ["sb2610","traiga","soc2","pci_saq_a","gdpr","hipaa_baa","eu_ai_act","tx_breach"],
  "reality": "real|simulated",
  "linked_risks": ["R-01"],
  "linked_policies": ["POL-01"],
  "notes": "..."
} ] }
```

## ai-systems.json
```
{ "systems": [ {
  "id": "AI-01", "name", "reality", "status": "production|internal|planned",
  "purpose", "plain", "users", "data_classes": ["public","customer-account","support-conversation"],
  "vendor": "Google", "model": "gemini-2.5-flash", "hosting": "Vercel serverless",
  "runtime": [ { "action": "...", "allowed": true|false, "guard": "...", "approver": "...", "logged": true|false } ],
  "human_oversight": "...", "logging": "...", "kill_switch": "...",
  "owner_role", "review_cadence_days": 180, "last_reviewed": "2026-09-13",
  "airmf": { "govern": "...", "map": "...", "measure": "...", "manage": "..." },
  "traiga": { "applies": true, "defense": "...", "status": "aligned|gap" },
  "eu_ai_act": { "class": "limited risk (Article 50 transparency)", "note": "..." },
  "linked_controls": ["NC-GV-07"], "linked_risks": ["R-06"],
  "evidence_links": [ { "label": "...", "url": "..." } ]
} ] }
```

## risks.json
```
{ "appetite": { "statement": "...", "plain": "...", "scale": "1 to 5 likelihood x 1 to 5 impact; appetite line at 9" },
  "risks": [ { "id": "R-01", "title", "plain", "category": "cyber|ai|third-party|resilience|compliance",
     "scenario": "...", "owner_role", "inherent": {"likelihood":4,"impact":5}, "residual": {"likelihood":2,"impact":4},
     "treatment": "mitigate|accept|transfer|avoid", "treatment_note": "...", "decision_required": false,
     "kri": "...", "trend": "up|flat|down", "linked_controls": ["NC-PR-07"], "reality": "simulated" } ] }
```

## scenario-breach.json
```
{ "id": "S-01", "title", "plain", "assumptions_note": "...",
  "frequency": { "min": 0.05, "mode": 0.2, "max": 0.6, "unit": "events per year" },
  "magnitude": { "min": 40000, "mode": 180000, "max": 900000, "unit": "USD per event" },
  "controls": [ { "id": "NC-PR-01", "label": "...", "effect": "frequency|magnitude", "factor": 0.5, "default_on": true, "note": "assumption" } ],
  "legal": { "id": "sb2610", "label": "SB 2610 safe harbor", "effect": "magnitude_tail", "factor": 0.7, "note": "..." },
  "appetite_annual_loss": 150000 }
```

## vendors.json
```
{ "vendors": [ { "id": "V-01", "name", "reality", "service", "plain", "tier": 1|2|3, "data_access": ["..."],
  "critical": true, "soc2_report": "on file (public trust center)|requested|n/a", "iso27001": true|false,
  "trust_center_url": "...", "subprocessor": true, "contract": { "breach_notice_hours": 72, "subprocessor_notice": true, "right_to_audit": false, "data_location": "US" },
  "review_cadence_days": 365, "last_reviewed": "2026-09-13", "concentration": "single model vendor", "linked_controls": [], "linked_risks": [] } ] }
```

## exceptions.json
```
{ "exceptions": [ { "id": "EX-01", "control_id": "NC-PR-05", "title", "plain", "reason", "risk_accepted_by_role", "opened": "2026-08-01", "expires": "2026-12-31", "compensating": "...", "reality": "simulated" } ] }
```

## glossary.json
```
{ "terms": [ { "term": "Control", "plain": "...", "more": "..." } ] }
```

## company.json
```
{ "name": "Nimbus", "legal_name": "Nimbus, Inc.", "reality": "simulated", "hq_state": "Texas", "hq_city": "<city, data only>",
  "employees": 180, "founded": 2019, "product": "...", "customers": "...", "jurisdictions": [...], "drivers": [...], "appetite_ref": "risks.json" }
```

## evidence/latest.json (generated)
```
{ "generated_at": "...", "run_id": "...", "source_commit": "...", "targets": [...],
  "checks": [ { "id": "check.headers.nimbus", "control_ids": ["NC-PR-07"], "result": "pass|fail|warn", "observed": "...", "expected": "...", "source_url": "..." } ] }
```
