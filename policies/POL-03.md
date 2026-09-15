---
id: POL-03
title: Access Control Policy
version: "1.3"
owner_role: Platform Lead
approved_by_role: Chief Operating Officer
last_reviewed: 2026-06-10
review_days: 365
reality: simulated
plain: Who gets access to what, how they prove who they are, and how access is removed when a job changes or ends.
---

# Access Control Policy

## Purpose

Make sure people and software get only the access their work needs, prove their identity before they get it, and lose it promptly when they no longer need it.

## Scope

All workforce accounts, administrator and production access, and every non-human identity (service accounts, API keys, workload credentials), including the keys used by AI systems.

## Policy statements

1. Multi-factor authentication is required for all workforce access. Administrator and production access requires phishing-resistant MFA (hardware security keys or platform authenticators).
2. Access follows least privilege. Each role has a defined set of entitlements; access outside the role needs a documented approval by the system owner.
3. Joiner: access is granted on a documented request approved by the manager and the system owner, and provisioned through the identity provider.
4. Mover: on a role change, the old role's access is removed and the new role's access granted within five business days. Access is never accumulated.
5. Leaver: all access is removed within one business day of departure, starting with the identity provider, and confirmed against the account inventory.
6. Owners review production and administrator access quarterly, remove what is no longer needed, and record reviewer, date, and actions.
7. Administrator work uses dedicated administrator accounts, never a daily account with elevated rights.
8. Every non-human identity is inventoried with owner, purpose, and scope, limited to least privilege, and its credential rotated at least every 180 days and immediately on suspected exposure. Short-lived workload credentials are preferred over standing keys.
9. Secrets live only in platform environment variables or a secrets manager, never in source control, client code, or documents. The repository is scanned for secret patterns on every build and daily.
10. Accounts with no sign-in for 45 days are disabled and reviewed before reactivation.
11. Unmanaged devices cannot reach production systems.

## Roles

- Platform Lead: owns this policy, production and administrator access, the non-human identity inventory, and key rotation.
- People Operations Lead: triggers joiner, mover, and leaver events and confirms completion.
- System owners: approve access to their systems and perform the quarterly reviews.
- All staff: use MFA, keep credentials private, and request access through the documented path.

## Exceptions

A standing key that cannot yet be replaced by a short-lived credential, or any other deviation, is recorded in the exceptions register with the reason, compensating controls, the accepting role, and an expiry date. Expired exceptions fail the build.

## Review

The Platform Lead reviews this policy at least every 365 days and after any incident involving access or credentials.
