---
id: POL-04
title: Data Classification and Retention Policy
version: "1.1"
owner_role: Security Lead
approved_by_role: Chief Operating Officer
last_reviewed: 2026-07-06
review_days: 365
reality: simulated
plain: How the company sorts its data into five sensitivity classes, protects each class, and decides how long to keep it.
---

# Data Classification and Retention Policy

## Purpose

Define the classes of data Nimbus holds, how each class is handled, and how long it is kept, so that sensitive data gets proportionate protection and nothing is kept longer than needed.

## Scope

All data Nimbus creates, receives, stores, or processes, including data that passes through AI systems.

## Policy statements

1. Data is classified into five classes: public, internal (business records not for publication), customer account (names, emails, workspace identifiers, billing status), customer content (what customers put into the product), and regulated (GDPR personal data, health information under a business associate agreement, or payment data).
2. Each class has an owner role, a handling rule, and a retention period in the data inventory. New data types are classified before collection.
3. Data in transit is encrypted with TLS 1.2 or higher; public endpoints redirect plain HTTP and send HTTP Strict Transport Security.
4. Customer account data, customer content, and regulated data are encrypted at rest with AES-256 using provider-managed keys; backups inherit the same protection.
5. Card numbers never touch Nimbus systems; the payment processor handles them, keeping PCI DSS scope at SAQ A.
6. Public AI endpoints retain no transcripts: no prompt, retrieved passage, or model output is written to logs or storage; visitor text is processed in memory only.
7. Customer content is deleted within 30 days of a verified deletion request or account closure, unless a legal hold applies.
8. Customer account and billing records are kept for seven years after closure for tax and contract obligations.
9. Security and access logs are kept for at least 12 months; internal records follow the data inventory schedule.
10. Regulated data is processed only under the governing contract and only in the systems it names.
11. Data is securely deleted at end of life; disposal of regulated data is recorded.

## Roles

- Security Lead: owns this policy and the data inventory.
- Platform Lead: implements encryption, retention, and deletion in production.
- Legal and Finance Lead: sets retention periods required by law or contract and approves legal holds.
- All staff: handle data by its class and never move it to a less protected system.

## Exceptions

Holding data past its retention period, or processing a class in an unapproved system, is recorded in the exceptions register with the reason, compensating controls, the accepting role, and an expiry date. Legal holds are reviewed quarterly.

## Review

The Security Lead reviews this policy and the data inventory at least every 365 days and whenever a new data class, jurisdiction, or customer type is added.
