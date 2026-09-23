# Compliance checklist (India-first)

> ⚠️ This is an engineering checklist, **not legal or tax advice**. Confirm every item with a Chartered Accountant and a lawyer before accepting real payments.

## Before accepting payments (Phase 2)

| Item                                    | Why                                                                                   | Status |
| --------------------------------------- | ------------------------------------------------------------------------------------- | ------ |
| Business entity + PAN, bank account     | Required by Razorpay for activation and payouts                                       | ⏳     |
| Own domain + HTTPS site                 | Razorpay and AdSense both review the live site                                        | ⏳     |
| Terms of Service                        | Razorpay requirement; defines the marketplace relationship                            | ⏳ P1  |
| Privacy Policy                          | DPDP Act, Razorpay and AdSense requirement                                            | ⏳ P1  |
| Refund and Cancellation Policy          | Razorpay requirement (see [revenue-model.md](revenue-model.md#refund-policy-default)) | ⏳ P1  |
| Contact page with address, email, phone | Razorpay requirement                                                                  | ⏳ P1  |
| Pricing shown in INR incl. taxes        | Consumer protection (e-commerce rules)                                                | ⏳ P2  |
| Instructor Terms                        | Revenue share, content ownership, payouts, TDS                                        | ⏳ P2  |

## Taxes

| Topic                       | Summary                                                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GST**                     | Online education/digital services are generally taxed at 18%. Registration is mandatory for e-commerce operators. Invoices must show GSTIN, HSN/SAC code and tax breakup. Generated automatically in Phase 2. |
| **TCS under GST (sec. 52)** | E-commerce operators collect tax at source on sellers' supplies and file GSTR-8. Confirm the applicability with a CA.                                                                                         |
| **TDS (sec. 194-O)**        | E-commerce operators deduct TDS on payments to sellers (instructors, mentors). The rate is set by the Finance Act; confirm with a CA. Deducted in the payout calculation in Phase 2.                          |
| **Foreign buyers**          | Sales to users outside India may fall under OIDAR/export-of-services rules. Handle before going global (Phase 7).                                                                                             |
| **Record keeping**          | Keep financial records for **8 years**, even after a user deletes their account (anonymise the personal parts).                                                                                               |

## Data protection: DPDP Act 2023 (and GDPR for EU visitors)

| Requirement                              | How we meet it                                                                               | Status             |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------ |
| Clear notice and consent for processing  | Plain-language privacy policy; consent at signup; cookie/ads consent banner                  | ⏳ P1/P2           |
| Purpose limitation and data minimisation | Collect only what a feature needs; IPs stored only as salted hashes                          | ✅ design          |
| Right to access and export               | "Download my data" (JSON)                                                                    | ⏳ P1              |
| Right to erasure                         | Account deletion: soft delete, then hard delete after 30 days (financial records anonymised) | ⏳ P1 (columns ✅) |
| Grievance officer                        | Named contact on the site                                                                    | ⏳ P1              |
| Breach notification                      | Process in [incident-response.md](../security/incident-response.md)                          | ✅ process         |
| Children's data (under 18)               | Verifiable parental consent required; decide minimum age (recommend 18+ for payments)        | ⏳ P1 decision     |

## Payments (Razorpay)

- We never see or store card numbers, UPI PINs or bank passwords. Checkout is Razorpay's hosted/embedded form (PCI-DSS is Razorpay's scope).
- Instructor payouts use **Razorpay Route**. KYC (PAN, bank) is collected by Razorpay's hosted onboarding. We store only the linked-account ID and KYC status.

## Advertising (Google AdSense)

- Needs your own domain, original content, a privacy policy, and a **Google-certified CMP** (consent banner) for EEA/UK/Switzerland visitors.
- Publish `ads.txt` at the domain root (Phase 2).
- Never place ads on pages with little content, in the lesson player, or next to checkout buttons (policy and UX).
