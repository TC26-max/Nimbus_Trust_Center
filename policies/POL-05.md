---
id: POL-05
title: Vendor and Third-Party Risk Policy
version: "1.1"
owner_role: Security Lead
approved_by_role: Chief Operating Officer
last_reviewed: 2026-05-19
review_days: 365
reality: simulated
plain: How the company checks outside suppliers before trusting them with data, what the contracts must say, and how often each supplier is looked at again.
---

# Vendor and Third-Party Risk Policy

## Purpose

Make sure every outside service Nimbus depends on is known, assessed before it handles company or customer data, bound by the right contract terms, and reviewed on a schedule that matches its risk.

## Scope

All service providers, including cloud hosting, model providers, source control, payment processing, and any software service that stores or processes Nimbus data.

## Policy statements

1. Every vendor is in the vendor register with its service, the data classes it can access, whether it is a subprocessor, its tier, and its owner role.
2. Tiers: tier 1 holds customer content or regulated data or is critical to availability; tier 2 holds customer account or internal data; tier 3 holds public data only or has no data access.
3. No vendor is onboarded before an assessment is recorded. Tier 1 and 2 assessments require a current SOC 2 report or ISO/IEC 27001 certificate where one exists, a review of the vendor's trust center, and a check of data location.
4. Contracts with tier 1 and tier 2 vendors include security requirements, a breach notification window of 72 hours or less, notice of subprocessor changes, data location, and termination and data return terms. A missing clause is recorded as an exception.
5. Customers receive at least 30 days' notice of subprocessor changes, and the public subprocessor list is updated at the same time.
6. Tier 1 vendors are reviewed annually, tier 2 every two years, and any vendor after a material change or incident. Tier 1 status pages and security bulletins are monitored.
7. Concentration risk is recorded in the risk register where one vendor supports a critical function without a tested alternative.
8. AI model providers are tier 1 vendors; model and provider changes follow POL-07, and provider incidents affecting the assistants are logged and assessed.
9. Vendor access to Nimbus systems follows POL-03 and is removed at the end of the relationship.

## Roles

- Security Lead: owns this policy, the vendor register, and the assessments.
- Legal and Finance Lead: owns contract clauses and the subprocessor notice.
- Platform Lead: monitors tier 1 status feeds and owns technical offboarding.
- Service owners: request new vendors with a business justification.

## Exceptions

A vendor onboarded without a complete assessment, or a contract missing a required clause, goes in the exceptions register with the reason, compensating controls, the accepting role, and an expiry date no later than the next renewal. Expired exceptions fail the build.

## Review

The Security Lead reviews this policy at least every 365 days and after any vendor incident that affects Nimbus or its customers.
