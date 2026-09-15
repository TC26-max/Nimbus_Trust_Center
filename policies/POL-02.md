---
id: POL-02
title: Acceptable Use and AI Use Policy
version: "2.0"
owner_role: Security Lead
approved_by_role: Chief Operating Officer
last_reviewed: 2026-08-28
review_days: 365
reality: simulated
plain: The rules for how staff may use company systems and AI tools, what may never be pasted into them, and how customers are told when they are talking to an AI.
---

# Acceptable Use and AI Use Policy

## Purpose

Set the rules for using Nimbus systems and AI so that AI helps without exposing customer data, misleading anyone, or acting beyond its permissions.

## Scope

All staff and contractors, company devices and accounts, every AI system in the AI inventory, and any AI tool used with company or customer information.

## Policy statements

1. Company accounts and devices are for business use; credentials are never shared.
2. Only AI tools listed in the AI inventory may be used with internal or customer data; the IT Lead approves additions.
3. Customer content, customer account data, regulated data, credentials, and secrets never go into any AI tool. Approved tools run in enterprise workspaces with training on company data turned off.
4. AI output is reviewed by a person before it is used in a decision about someone or sent to a customer.
5. Customer-facing AI systems disclose that they are AI, offer a human on request, and never claim an action they cannot take. The rules are in each system prompt and checked at build.
6. Each AI system has a written list of allowed actions. Anything with real-world effect needs a deterministic code guard or a human approval.
7. Public AI endpoints keep no transcripts. Visitor text is capped and labelled untrusted before it reaches a model.
8. Kill switch authority: the Platform Lead, Security Lead, or Chief Operating Officer may disable any AI system by removing its provider credential and redeploying. Switching off needs no approval; switching on does.
9. Harmful or false AI output, data leakage through a model, or an unintended action is reported as an AI incident under POL-06 the same day.
10. A model or provider change is a change under POL-07: full test matrix and adversarial testing before release.
11. Expense and SaaS discovery data are reviewed quarterly for unapproved AI services.

## Roles

- Chief Operating Officer: owns AI risk decisions and approves this policy.
- Security Lead: owns this policy, the AI inventory, and adversarial testing.
- Product Lead: owns the customer-facing personas.
- Platform Lead: owns the endpoints, caps, secrets, and the kill switch.
- IT Lead: approves internal AI tools and runs the quarterly shadow AI review.

## Exceptions

Any deviation, such as an unlisted tool, goes through the exceptions register with a reason, compensating controls, an accepting role, and an expiry date within 90 days. Expired exceptions fail the build.

## Review

The Security Lead reviews this policy at least every 365 days, after any AI incident, and when a new AI system joins the inventory.
