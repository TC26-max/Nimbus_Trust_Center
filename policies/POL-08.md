---
id: POL-08
title: Business Continuity and Backup Policy
version: "1.0"
owner_role: Platform Lead
approved_by_role: Chief Operating Officer
last_reviewed: 2026-05-27
review_days: 365
reality: simulated
plain: How the company keeps copies of customer data, how fast it promises to get the service back after a failure, and how it keeps customers informed while doing so.
---

# Business Continuity and Backup Policy

## Purpose

Make sure Nimbus can restore its services and customer data after a failure, an attack, or a vendor outage within stated time and data-loss limits, and keep customers informed while it does.

## Scope

All production services, customer data stores, backups, the public sites including the AI assistants, and the vendors those services depend on.

## Policy statements

1. Every production service has a recovery time objective (RTO) and a recovery point objective (RPO) in the recovery plan. Baseline targets: core product, RTO 4 hours and RPO 1 hour; public sites and AI assistants, RTO 4 hours and RPO 24 hours (no customer data); internal tools, RTO 24 hours and RPO 24 hours.
2. Customer data is backed up automatically at least daily, encrypted with the same protection as the primary data.
3. At least one backup copy is kept in an isolated location with separate credentials, so a compromise of production access cannot delete it.
4. Backups follow the retention schedule in POL-04.
5. A restore is tested at least quarterly, recording the backup used, the integrity check, the restore time, and the verification against known-good state.
6. The recovery plan defines the order of restoration, the roles involved, and the criteria for declaring recovery complete, and is reviewed annually.
7. Tier 1 vendor outages are continuity events: the Platform Lead assesses impact and records a workaround or a wait decision. The AI assistants degrade to a visible unavailable state when the model provider or its key is unavailable; the rest of the site keeps working.
8. Customers are informed of outages and recovery progress through the public status page. The Chief Operating Officer approves messaging; the Product Lead posts updates at least every two hours during a Sev 1 incident.
9. Previous deployments are retained so a bad release can be rolled back within minutes.

## Roles

- Platform Lead: owns this policy, backups, restore tests, the recovery plan, and rollbacks.
- Product Lead: owns status page communication and customer updates.
- Chief Operating Officer: approves external messaging and any decision to operate beyond the recovery objectives.
- Security Lead: confirms that backups and restores meet POL-03 and POL-04.

## Exceptions

A service without approved recovery objectives, a missed restore test, or a backup not yet isolated is recorded in the exceptions register with the reason, compensating controls, the accepting role, and an expiry date. Expired exceptions fail the build.

## Review

The Platform Lead reviews this policy at least every 365 days, after any restore test failure, and after any incident that missed a recovery objective.
