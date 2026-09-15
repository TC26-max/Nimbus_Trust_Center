---
id: POL-01
title: Information Security Policy
version: "1.2"
owner_role: Security Lead
approved_by_role: Chief Operating Officer
last_reviewed: 2026-08-15
review_days: 365
reality: simulated
plain: The top-level rulebook that says who is responsible for protecting company and customer information and how the other security policies fit together.
---

# Information Security Policy

## Purpose

Establish how Nimbus protects the confidentiality, integrity, and availability of customer and company information, and name who is accountable for that protection.

## Scope

All staff, contractors, systems, data, and vendors that process Nimbus information, including every AI system in the AI inventory. This policy is the parent of POL-02 through POL-08; the more specific child policy applies where they overlap.

## Policy statements

1. The Chief Operating Officer is the executive accountable for cybersecurity and AI risk. The Security Lead runs the program and reports to the board quarterly.
2. Nimbus adopts NIST CSF 2.0 as its security framework and records the adoption date and the process for taking up revisions. At 100 to 249 employees this adoption is the basis for the Texas SB 2610 safe harbor.
3. Every control has an owner role, a test procedure, an evidence type, and a freshness window; evidence past its window is reported as stale, not hidden.
4. The risk register is reviewed quarterly against the board-approved risk appetite. Every risk has an owner, inherent and residual ratings, a treatment decision, and a key risk indicator.
5. A register of legal, regulatory, and contractual obligations is reviewed semiannually and whenever a new jurisdiction or customer type is added.
6. Policies are version-controlled, approved by the accountable executive, communicated to staff at hire and on change, and reviewed at least every 12 months.
7. Staff complete security awareness training at hire and annually.
8. Deviations from any control are recorded in the exceptions register with a reason, an accepting role, compensating controls, and an expiry date.
9. Security and AI incidents are handled under POL-06. Anyone may raise a suspected incident without blame.
10. Public sites publish a vulnerability disclosure channel (security.txt) with a contact address and a future expiry date.

## Roles

- Chief Operating Officer: accountable executive; approves policies and accepts any risk above the appetite line.
- Security Lead: owns the program, the control library, the registers, and this policy.
- Platform Lead: owns production systems, secrets, backups, and the daily evidence job.
- All staff: follow the policies, complete training, and report suspected incidents.

## Exceptions

Any deviation from this policy or a child policy is recorded in the exceptions register with the reason, the accepting role, compensating controls, and an expiry date no more than 12 months out. An expired exception fails the site build until it is renewed or closed.

## Review

The Security Lead reviews this policy at least every 365 days and after any material change to the business, the framework, or the law.
