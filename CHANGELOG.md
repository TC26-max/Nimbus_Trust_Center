# Changelog

## 1.0.0 (2026-09-15)

First release.

- Trust Center front door and nine Control Room views generated from one data set (54 controls, 5 AI systems, 15 risks, 7 vendors, 8 policies, 4 exceptions, 44 glossary terms).
- Crosswalk to NIST CSF 2.0 (all six functions), CIS Controls v8.1 with IG flags, SOC 2 TSC, and NIST AI RMF 1.0; legal drivers as columns (Texas SB 2610, Texas HB 149, Texas breach notification, PCI DSS SAQ A, GDPR, HIPAA BAA, EU AI Act with the 2026 Omnibus dates).
- AI inventory with runtime permissions, oversight, logging, kill switch, AI RMF rows, and vendor due diligence.
- Daily evidence job (headers, transport, security.txt, dependency audit, gates, secret scan, policy and exception freshness, inventory completeness) with freshness and drift on every control.
- Quantified loss scenario (triangular sampling, 10,000 trials, seeded) with control levers and the SB 2610 safe-harbor toggle.
- Two-page board brief generated from the data, printable.
- Control mapper: keyword shortlist, model choice restricted to the shortlist, server-side validation, keyword fallback, fair-use limiter, input caps, no storage.
- Plain and Technical reader modes; dark and light themes; real versus simulated labels on every card.
- Gates: static, endpoint, ui; mapper gold-set eval; findings register with a gate per fixed finding.
- Security headers: hash-pinned CSP for scripts and the stylesheet, HSTS, nosniff, frame denial, referrer and permissions policies, COOP and CORP.
