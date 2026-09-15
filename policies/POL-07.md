---
id: POL-07
title: Secure Development and Change Management Policy
version: "1.2"
owner_role: Platform Lead
approved_by_role: Chief Operating Officer
last_reviewed: 2026-09-01
review_days: 365
reality: simulated
plain: How code and configuration get from an idea to the live site, with automated checks that stop a bad change, and how quickly known flaws must be fixed.
---

# Secure Development and Change Management Policy

## Purpose

Make sure every change to Nimbus software, configuration, and AI systems is built from controlled sources, tested by automated gates before it reaches production, and traceable to a known commit.

## Scope

All application code, platform configuration, third-party dependencies, prompts and model settings for AI systems, and the build scripts that generate deployable files.

## Policy statements

1. Pages, platform configuration, and security headers are generated from templates and data by a build script. Generated files are never hand-edited; a rebuild that differs from the committed output is a failed change.
2. Every change is reviewed and passes the static, endpoint, and UI gates, which run on every push; a red gate blocks the deploy.
3. Dependencies are pinned by a lockfile and audited for known vulnerabilities on every build and by the daily evidence job.
4. Remediation windows: critical within 7 days, high within 30 days, all others within 90 days. A window that cannot be met is recorded as an exception.
5. Secrets are never committed. The repository is scanned for secret patterns on every build and daily.
6. A model change is a change. Model and provider names are pinned in configuration; changing either runs the full test matrix before and after, with results recorded.
7. Every AI system is tested adversarially (prompt injection, false authority, policy abuse, data exfiltration, phantom action claims) before release and after any model change. Each finding goes to the findings register with a gate that prevents regression.
8. Prompts and persona rules live in one source file, are injected into every shipped copy at build, and are checked against a shared rule list so a rule cannot silently drop out of one copy.
9. Deployments come from a known commit and can be rolled back within minutes.
10. Production regressions get a written review with root cause and actions within two weeks.

## Roles

- Platform Lead: owns this policy, the build script, the gates, dependency audits, and deployments.
- Security Lead: owns adversarial testing and confirms remediation windows are met.
- Product Lead: approves prompt and persona changes for the assistants.
- Engineers: author changes through the reviewed path and never bypass a gate.

## Exceptions

A change shipped with a red gate, a missed remediation window, or a review by the author alone is recorded in the exceptions register with the reason, compensating controls, the accepting role, and an expiry date. Expired exceptions fail the build.

## Review

The Platform Lead reviews this policy at least every 365 days and after any production regression or model change with a customer-visible defect.
