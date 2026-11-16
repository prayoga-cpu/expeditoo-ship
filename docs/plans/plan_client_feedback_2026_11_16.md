# Plan — Nicolas's feedback of 16 November 2026 (2.85.0)

Spec: `docs/specs/client_feedback_2026_11_16_spec.md`.

## Items

| # | Feedback | Decision | Release |
|---|---|---|---|
| F1 | Private vs professional driver, with a radio on sign-up | **Not built.** `carriers.kind` exists (0044) but nothing sets it, and the field list for a private driver is the client's to give (« I will review the type of … to be included »). Build once he sends it. | — |
| F2 | An application shows nowhere in Users; the role cell is empty | Fix: application chip in the role column, tab badge, status column moved forward | 2.85.0 |
| F2b | « Chauffeur » can be granted by hand with no file | Fix: dialog stops offering it; `assignRole` refuses it without an approved carrier | 2.85.0 |
| F3 | No way to answer an ad with a price on a tablet | Fix: « Faire une offre » on the card, `#offer` anchor, floating button, explicit notes for owner and staff | 2.85.0 |

## Steps

1. `carriersDal.statusesByUserIds` → `getUsers` adds `driverApplication` → DTO, `User`, mapper.
2. `UsersTable` `ApplicationChip`; `RoleManagementDialog` drops « Driver » and links to the applications.
3. `assignRole`: `carrier` / `driver` need an `approved` carrier row.
4. Drivers page: count badge on the « Dossiers » tab from `useAdminNavCounts().applications`;
   the status column of `CarrierApplicationsList` sits straight after the applicant.
5. `JobCard` `offerAction`; `JobBoard` sets it; `JobBidSection` anchors `#offer`, floats a button
   below `xl`, and says why there is no form to the owner and to staff.
6. FR/EN copy; tests; release records.

## Not in scope

- F1 (above).
- `BoardJob.hasBid` is never sent by the board endpoint, so « Vous avez enchéri » never shows and the
  new button is offered on jobs the driver already bid on (they land on their own offer card). Noted in STATUS.
