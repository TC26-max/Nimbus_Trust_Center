---
id: POL-06
title: Incident Response and Breach Notification Policy
version: "1.4"
owner_role: Security Lead
approved_by_role: Chief Operating Officer
last_reviewed: 2026-08-03
review_days: 365
reality: simulated
plain: What counts as a security or AI incident, who does what when one happens, and who must be told by when.
---

# Incident Response and Breach Notification Policy

## Purpose

Make sure security and AI incidents are recognized quickly, handled by named roles in a set order, and reported to everyone who must be told within the time the law or a contract allows.

## Scope

All events affecting Nimbus systems, data, staff, vendors, or AI systems, however they are discovered.

## Policy statements

1. Declaration criteria: confirmed or likely unauthorized access to data or systems; loss of integrity or availability beyond the recovery objectives; a vendor breach affecting Nimbus data; or an AI incident (harmful or discriminatory output, data leakage through a model, vendor model failure, or an unintended action by an AI system).
2. Anyone may report a suspected incident; the Security Lead, Platform Lead, or Chief Operating Officer may declare one.
3. Severity is set on declaration and revised as facts change: Sev 1 (customer data exposed or service down for many customers), Sev 2 (one customer affected or material internal impact), Sev 3 (contained, no data exposure).
4. Reports are triaged within four hours; Sev 1 incidents reach the Chief Operating Officer within one hour of declaration.
5. AI incident escalation path: disable the system with the kill switch, notify the AI system owner and the Chief Operating Officer within one hour, assess legal duties, then communicate to affected customers. The path is exercised in the annual tabletop.
6. Notification windows: affected individuals within 60 days; the Texas Attorney General within 30 days when 250 or more Texas residents are affected; the EU supervisory authority within 72 hours of awareness under GDPR; customers by their contract window; HIPAA covered entities per the business associate agreement.
7. The Legal and Finance Lead confirms each notification before it is sent; the Chief Operating Officer approves external messaging.
8. Evidence is preserved where that does not increase harm; actions are logged with timestamps.
9. A written post-incident review (timeline, root cause, assigned actions) is completed within two weeks of closure.

## Roles

- Security Lead: incident commander; owns this policy and the incident register.
- Platform Lead: containment, eradication, recovery, and the kill switch.
- Legal and Finance Lead: notifications, regulator contact, and contract windows.
- Product Lead: customer communication and status page updates.
- Chief Operating Officer: severity approval, external messaging, and resourcing.

## Exceptions

A deviation, such as a delayed post-incident review, is recorded in the exceptions register with the reason, the accepting role, compensating controls, and an expiry date.

## Review

The Security Lead reviews this policy at least every 365 days, after every Sev 1 or Sev 2 incident, and whenever an applicable notification law changes.
