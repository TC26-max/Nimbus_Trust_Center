# Interview explainer: talking points for the builder

## The thirty-second description

Nimbus Trust Center is a public governance, risk, and compliance site for a fictional Texas software company of about 180 employees. It has a control library crosswalked to NIST CSF 2.0, CIS Controls, SOC 2, and the NIST AI RMF, a risk register with an appetite line, a quantified breach scenario, a vendor register, an AI system inventory, and a daily evidence job that checks the live sites and writes down what it found.
The AI systems in the inventory are real: they are the builder's deployed Grounded assistants, and their tests, findings, and source are linked from the inventory.
Everything else about the company is simulated and labelled as such.

## Real versus simulated, and why that is the point

Every record on the site carries a reality field. Real means it exists and can be inspected: the assistants, their source, their gates, the headers on the live sites, the evidence job, the control mapper.
Simulated means it was invented for the story: the company, its board, its attestations, its SOC 2 report, most of its vendors.
The honesty is the point because a trust center that blurs the two is the exact failure a GRC program exists to prevent. Auditors, customers, and regulators all ask the same question: show me.
A portfolio that says "simulated" on the things it cannot show earns the right to be believed on the things it can.
The builder should say plainly that the AI controls are the strongest part because they are backed by running code and public findings, and that the people-process controls are the weakest because they are backed by simulated attestations.

## The views and what each proves

1. Trust Center (#trust): the public front door. Framework status, safeguards a visitor can check, what each AI assistant cannot do, subprocessors, the rules the company works under, and a real-versus-simulated notice. Proves the builder knows what a trust page looks like from the customer's side.
2. Overview (#overview): control health, automated evidence count, risks above appetite, open exceptions, coverage per framework, the company card. Proves the builder can summarize a program for a non-technical reader.
3. Controls (#controls): the control mapper (paste a questionnaire question, get up to three controls, AI-proposed and analyst-confirmed), then the library of 54 controls with owner, frequency, test procedure, evidence state, and mappings, switchable to a framework-first crosswalk. Proves that one control serves many obligations and that an unmapped reference fails the build.
4. AI Systems (#ai): five systems with purpose, data classes, runtime permission tables, oversight, logging, kill switch, AI RMF rows, TRAIGA and EU AI Act columns, model vendor due diligence, and the AI incident escalation path. Proves the builder can inventory AI the way Texas law and the EU AI Act expect.
5. Evidence (#evidence): the latest bundle keyed by control, freshness and drift, manual controls by age, the before-and-after comparison, and honest limits. Proves continuous monitoring is a script and a schedule, not a promise.
6. Risks (#risks): heat map with the appetite line, the register with inherent and residual scores, and the quantified breach scenario with control levers and the SB 2610 safe-harbor toggle. Proves the builder can turn threats into decisions and quantify one of them.
7. Vendors (#vendors): a tiered register with data access, assurance reports, contract clauses, subprocessor flags, and concentration risk. Proves third-party risk is managed as a register, not a folder of PDFs.
8. Board Brief (#board): two printable pages generated from the same data, in board language. Proves the builder can write for executives.
9. Tested (#tested): this site's own findings register with a gate per fixed finding, gate counts, mapper accuracy, the real-versus-simulated table, the policies, and the About lines. Proves the builder tests the thing that claims to be tested.
10. Glossary (#glossary): plain definitions first, technical detail second, searchable.

Every view has a Plain and a Technical reading, switched in the header. Policies and exceptions open from the views; policy freshness and exception expiry are checked at build and by the daily job.

## Five failure and tradeoff stories from the real assistants, framed as GRC lessons

### 1. The lost hand-off rule

In July 2026 live probing found that the support assistant's shipped prompt no longer contained the human-request rule; it had been dropped during a prompt condensation. The September audit found the same pattern on the sales persona, which had lost its crisis clause while the support persona kept it.
The fix was one source file for both personas, a shared rule list, and a build gate that fails if any rule is missing from either persona or from the page's fallback copy.
Lesson: a control that lives in two places will drift. A document asserting a rule is not a control until a test fails when the rule is gone.

### 2. The model upgrade truncation

Upgrading to gemini-2.5-flash silently billed hidden reasoning tokens against the reply budget and cut answers off mid-sentence. It was caught on a phone, not by a test.
The fix disabled reasoning in the request and added the rule that a model change is a change, with a full regression run before and after.
Lesson: vendor changes are changes. Pin model names, and run the whole matrix on every swap, not only the test for the thing that broke.

### 3. The per-instance limiter

The fair-use limiter is an in-memory map inside a serverless function. It is keyed on the platform's client IP after an audit finding showed that a client-writable header could rotate it. It bounds cost per warm instance and is not global; a production system would use a shared store.
Lesson: write the boundary of a control into the control itself. "Bounds cost, not a security boundary" is a more defensible sentence than "rate limited".

### 4. The no-transcript tradeoff

The assistants store no conversations. That is good privacy and a real gap: there is no log to review after an incident.
The site records this as a partial output-monitoring control with an exception, and names the compensating controls: adversarial testing and the on-page claim guard.
Lesson: privacy and detectability pull against each other. The mature move is to record the decision, not to pretend both are maximized.

### 5. The untrusted visitor edits

The editable knowledge base let a visitor fill 65 percent of the system prompt with unlabelled text, a direct injection channel inside a feature the page advertised.
The fix capped edits to three passages of 240 characters, labelled each one VISITOR-EDITED and untrusted, told the persona to treat them as data, and added a gate on the attacker byte share.
Lesson: every feature that accepts input is an attack surface. Quantify the exposure, cap it, label it, and gate the number.

## How the Texas laws are used, and why the city is not emphasized

SB 2610 is the cybersecurity safe harbor: a company under 250 employees that adopts a recognized framework cannot be hit with exemplary damages after a breach.
Nimbus sits in the 100 to 249 tier, adopts NIST CSF 2.0, and records that decision as a control; the breach scenario models the safe harbor as a reduction of the loss tail, labelled as an assumption.
TRAIGA (HB 149, effective January 1, 2026) makes documented NIST AI RMF compliance an affirmative defense, with Attorney General enforcement and a 60-day cure period.
That is why every AI inventory entry has one concrete sentence each for Govern, Map, Measure, and Manage, and a traiga block with a defense statement and a status; AI-04 is marked as a gap on purpose.
The Texas breach notification statute sets the clocks in the incident policy: individuals within 60 days, the Attorney General within 30 days at 250 or more residents. GDPR's 72 hours and the EU AI Act's Article 50 duty (applying from August 2, 2026, with high-risk obligations deferred to December 2, 2027) sit beside them as drivers.
The city is not emphasized because none of these obligations depend on it; jurisdiction is the state. Keeping "Texas" only where a law needs it keeps the driver logic portable to another state and keeps the site from reading as a personal detail rather than a legal one.

## What a real program would integrate next

The evidence job today checks what a public site can prove: headers, the disclosure file, the dependency audit, gate results, the secret scan, and policy and exception freshness. The next integrations are named on the site rather than faked:
- Cloud provider APIs for configuration, encryption state, and logging settings.
- The identity provider for MFA enforcement, access reviews, and joiner, mover, and leaver events.
- Device management for encryption and endpoint protection coverage.
- Ticketing for incident timelines, change approvals, and the exception workflow.
- A GRC platform to hold the evidence, map it to controls, and run the audit.
Each of those would convert a simulated attestation into an automated check with a freshness window.

## Honest limits

- Single maintainer: review is by the author with AI assistance and the gates; the gates are the enforceable part, and the site says so.
- Simulated attestations: most people-process controls are asserted by a role that does not exist, and the reality field says so on every one.
- Per-instance limiter: the fair-use cap is per warm serverless instance; a production deployment needs a shared store.
- Keyword fallback: the control mapper falls back to keyword-only proposals when no model key is configured, labelled as such, and even with a key the analyst confirms every proposal.
- Unmeasured numbers on the assistants: the hybrid retrieval recall needs a live run, the faithfulness checker is off in the public deployment, and session metrics are not aggregated server-side by privacy design.

The builder should lead with these limits rather than wait to be asked. The site was designed so that the honest answer is the same as the impressive one.
