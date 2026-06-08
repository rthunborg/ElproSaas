# E0 Owner Question List

Date: 2026-06-08

Use these questions with the electrician friend before Phase A PRD approval. Keep answers concrete enough to drive acceptance criteria and golden-master fixtures.

## Workflow Priority

- Which Phase A workflow must work first: CRM, calculation, quote PDF, acceptance, basic job, or files?
- What is the smallest end-to-end pilot flow that would prove the rebuild is useful?
- Should the pilot support only one tenant admin user at first, or multiple tenant admins in the same company?
- Is sending a quote manual PDF/status tracking only, or must the system send email in Phase A?
- Which current Lovable screens are essential, and which can be ignored during the pilot?

## CRM/Customer Data

- Which customer types are needed in Phase A: private, company, BRF, foundation, public sector?
- Is an anläggning required for every quote/job, or can a quote belong only to a customer?
- Can one customer have multiple facilities in the pilot?
- Can a contact belong to a facility, or should contacts be customer-wide only?
- Should one primary contact be enforced per customer, per facility, or not enforced?
- Which customer fields are mandatory for a quote PDF?
- Should personnummer be excluded until invoicing/SKV workflows are approved?

## Calculations

- Which row types are essential: material, labor, subcontractor, machinery, other?
- Are work roles required for labor pricing, or can labor be entered manually?
- Are articles/material price lists required in Phase A, or can they wait?
- Should calculation sections support detailed, summary, and text-only quote display?
- Should options/tillval be included in Phase A?
- Should hidden quote rows still count in totals and tax deductions?
- What margin warnings are useful enough for the pilot?
- What rounding rule should be used: per line, per section, or document total?

## Quotes/PDF/Acceptance

- What quote number format should be used?
- When does a quote become immutable: sent, accepted, or another status?
- What statuses are required in Phase A?
- What must be shown on the PDF: VAT excluded, VAT included, or both?
- What standard terms should be used, and who approves the wording?
- Which attachment types should appear inline versus appendix?
- What acceptance evidence is legally sufficient: phone note, email, signed PDF, meeting note, or portal action?
- Can the accepted price differ from the quote price, and what reason/evidence is required?

## Jobs/Order/Project Terminology

- What should the accepted quote create: jobb, order, projekt, arbetsorder, or another term?
- What fields are required on the first job/order record?
- Should all accepted quotes create a job automatically?
- Should repeated acceptance be blocked, idempotent, or treated as a correction?
- Are planned start/end dates needed at acceptance time?
- Which job features are definitely not needed for Phase A?

## Files/Documents

- Are files managed only from CRM/calculation/quote/job screens, or is a standalone document center required?
- Which files are required before a quote can be sent?
- Which files are required before a quote can be accepted?
- Which files should be copied or snapshotted into the quote version?
- Should quote evidence files be immutable after acceptance?
- What file types and size limits are acceptable for the pilot?
- Who can delete or restore a file in Phase A?

## ROT/Grön Teknik/Accounting Assumptions

- Confirm current ROT rate, cap per person, eligible base, and VAT handling.
- Confirm current grön teknik rates for solar, battery, and charging point.
- Confirm grön teknik cap per person and whether the 3% schablon is valid.
- Are BRF customers eligible for ROT and/or grön teknik in this product flow?
- Should tax deduction amounts be presented as estimates or promised reductions?
- What customer-facing disclaimer text is required?
- What accounting/legal source should be treated as authoritative for pilot sign-off?

## Migration/Coexistence

- Which current Lovable records must migrate live into Phase A?
- Which records should be archive-only or view-only?
- Which records should remain only in the old app?
- Which active calculations and quotes should become golden-master fixtures?
- Which accepted quote/job examples should be used for shadow comparison?
- How long should the old app remain available during coexistence?
- What result would be good enough to approve pilot cutover?

