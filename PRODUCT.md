# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: the SK officials of Barangay Salinas 1, City of Bacoor, Cavite.** The SK Admin (who runs the system day to day), the SK Treasurer, the SK Secretary, the SK Chairperson and the kagawads, plus the **Barangay Chairman**, who approves and views but does not edit. They work in the admin panel, mostly on computers at the barangay hall, between council meetings, with printed forms and signature sheets beside them. Their comfort with software varies; many are young volunteers, not office staff. (The questionnaire question about computer comfort was left unanswered.)

**Secondary: residents and youth of the barangay.** They look at the public site, mostly on phones, to see approved projects, progress, budgets, expenses and upcoming events.

Officials on computers, residents on phones (confirmed).

## Product Purpose

A project monitoring system for the Sangguniang Kabataan. It replaces paper and scattered notes with one record per project that follows the SK's real procedure: a proposal written on the SK's request form, approval by the Barangay Chairman, progress that is worked out automatically, expenses backed by uploaded receipts, completion confirmed by SK council approval, deletion only through an approved request, and an accomplishment report ready to print.

Success means an SK official can answer "where is this project, what did it cost, and who approved it" from the screen, and a resident can see the same facts without asking.

Current stage: a **capstone** (demo and defense first). SK Salinas 1 may adopt it afterwards (confirmed). Do not describe it as in production use.

## Positioning

It mirrors how an SK actually works, not a generic project tracker. The proposal form is laid out like the SK's own printed Purchase Request sheet, the approval chain is the SK's (kagawad proposes, SK council and Barangay Chairman approve), progress follows the SK's own measures (sessions held, or the timeline), money leaves the budget only with a receipt, and nothing is ever erased: deleted projects move to an archive. A neighbouring tool would not know the chairman's sign-off, the council resolution, or the PR sheet.

## Operating Context

- SK council meetings: proposals are explained and approved there before they reach the system.
- Paper documents: the Monthly Itemized List of Purchase Request (PR) sheet with PREPARED BY / NOTED BY signatures, printed attendance and signature sheets (kept by the SK Secretary), disbursement vouchers and certificates as proof of spending.
- Reports the SK files: the Accomplishment Report (AR), the Full Disclosure Policy (FDP) report and COA reports, to LYDO, DILG and the COA accounting office (recipients as best understood from a handwritten answer; unconfirmed).
- Time and money: Philippine time, pesos.
- Roles in the system: SK Admin, Barangay Chairman (view with approval rights), public viewer. Secretary, Treasurer and Kagawad roles are not separate yet; the SK Admin acts for them.

## Capabilities and Constraints

- Project lifecycle: Proposed, then Planning (after chairman approval), Ongoing (when the start date arrives), Completed (with SK council approval date) or Cancelled (with a written reason). Status is never typed in freely.
- Progress is computed: sessions held out of sessions scheduled when events are linked, otherwise the elapsed share of the start-to-end time. The checklist is a to-do aid and does not change the percentage. Only "Completed" reaches 100%.
- Alerts: an in-app bell and optional Gmail email at 50%, 75% and 90% progress, when a project ends within 3 days or 1 day, and when it is overdue.
- Expenses are manual budget deductions and require a receipt (JPG, PNG, WebP or PDF, up to 5 MB). Receipts are visible to the admin and the chairman only.
- Deletion: the SK Admin files a request with a reason, the chairman approves, and the project moves to the Archive (read-only; the chairman can restore it).
- The public sees approved, non-archived projects, their progress, budget, expenses and events. Not shown publicly: proposals, rejected proposals, receipts, deletion requests, the archive.
- Accomplishment report: print-ready A4 page, saved as PDF through the browser.
- Terminology to keep: SK, Kagawad, Barangay Chairman, Chairperson, Purchase Request (PR), Accomplishment Report, LYDO, DILG, COA, "Mark as completed", "Request delete" (which archives).
- Stack and structure already exist in the repository (React client, Express and PostgreSQL server); not an open decision.
- Open product decisions: whether the system will read receipts automatically (asked, awaiting the owner's answer); separate Secretary / Treasurer / Kagawad accounts; whether receipts become visible to the public; per-official photos.

## Brand Commitments

- The **seal of the Sangguniang Kabataan, Salinas 1, City of Bacoor** is the logo (`client/public/logo.jpg`).
- Official letterhead wording used on forms and reports: Republic of the Philippines / Province of Cavite / CITY OF BACOOR (in red) / BARANGAY SALINAS 1 / OFFICE OF THE SANGGUNIANG KABATAAN.
- The SK's own printed Purchase Request sheet is a binding reference for the proposal form's layout (bordered table, centred bold cells, PREPARED BY / NOTED BY block).
- The system name in the interface is "SK Monitoring" / "SK Project Monitoring System".

## Evidence on Hand

- The SK Salinas 1 officials and their positions, entered from the SK's group photo (`picture/`): Sehj Miranda (Chairperson), Kyrar Espiritu (Secretary), Alison Reyes (Treasurer) and seven kagawads. Formal full names appear on the SK's printed sheet and are not all in the system.
- The SK seal image. The **Barangay Salinas 1 seal is not available** as a file yet; the form leaves room for it.
- Capstone documentation and screenshots in `docs/`, and diagrams in `diagrams/`.
- Answers to the client questionnaire about procedures (proposal, approval, progress, cancellation, deletion, finances, attendance, reports, public information).
- Absent, and not to be invented: real project history, real expenses, resident testimonials, usage numbers, an emergency-hotlines feature (an image was provided but not requested).

## Product Principles

1. **Mirror the SK's real procedure.** If the SK does it on paper in a certain order, the system follows that order and those words.
2. **Every number can be explained.** Progress, budget, remaining and totals show how they were worked out, so an official can defend them to the chairman or an auditor.
3. **Proof before money.** Spending needs a receipt, completion needs council approval, deletion needs a reason and the chairman's approval.
4. **Nothing is erased.** Records are archived, never destroyed.
5. **Plain words for first-time users.** Officials are volunteers; labels, errors and hints say what to do next in everyday language.

## Accessibility & Inclusion

Officials mainly use computers and residents mainly use phones, so the admin panel must be comfortable on a desktop screen and the public pages must work on small phones. Officials' computer comfort varies (unconfirmed), so avoid jargon and keep important actions obvious. No formal accessibility standard was specified.
