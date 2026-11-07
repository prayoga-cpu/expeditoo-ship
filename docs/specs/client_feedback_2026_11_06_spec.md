# Client feedback of 4–6 November 2026 — spec

Source: `EXPEDITOO_Nicolas_Feedback_for_Darwin_04-06_November_2026_EN.pdf`, plus the owner's request for a minimalist phone shell and a PWA install / full-screen toggle (referring to the Epidom app).

## Done

| ID | Behaviour | Error / edge |
|---|---|---|
| B01, B04 | One usable vehicle is preselected; the submit button is disabled with a line naming the first missing thing: vehicle → price (≥ €1) → day. | An inactive or too-small vehicle is never preselected. |
| B03 | When every day the job can take is chosen, the calendar popover says `noMoreDays`. | At the 4-day cap the existing `dayLimit` text stands. |
| A06 | `overBudget` copy: « Au-dessus du budget du client. C'est autorisé. » | — |
| A05 | `listings.access_height_cm` nullable double, optional in the DTO (positive, ≤ 1000), shown as « Hauteur maximale d'accès » on the job page. | Not a vehicle filter. |
| A03 | Street line optional; city and postal code stay required. | A pin is looked up from postcode + town. |
| C03 | Alias shown under the name in `UsersTable` and in the shipments table's driver column. | — |
| U03 | « Retour » on Historique des transactions, `/driver/dashboard` and the home driver dashboard; history back, else `/profile`. | — |
| U02 | White light background, neutral surfaces; lighter dark; first visit defaults to light. | — |
| Phone chrome | Floating frosted bottom capsule for all three shells; no Account tab; `HeaderToolbox` (language, theme, install, full screen, feedback) behind one button below `md`. | Install hidden when standalone; full screen hidden without the API. |

| A02 | Steps: What → When → Where → Budget. | A draft with a snapped time still opens on When. |
| A04 | Per end, a two-button group: new address / saved address; the select only in saved mode; saved is disabled with an empty book. | — |
| B02 | « Envoyer l'offre » opens an in-card summary; « Confirmer l'offre » sends; « Modifier » returns. | Nothing is sent before the confirm. |
| C05 | « Mes trajets » link in both profile link lists for drivers. | — |
| Home | « N new jobs in the last 24 h » card (hidden at zero); « switch to Driver mode » card for a driver browsing as a requester. | Page of 50 → « 50+ ». |
| Top bar (phone) | Logo, quick settings, bell, avatar; access switch inside quick settings; quick actions hidden below `md`. | — |
| C01 | Already satisfied (admins alerted on every submitted application). | — |

## Test coverage required

`SubmitOfferForm.test.tsx` (preselect, missing-day, missing-price), `FloatingNav.test.tsx`, `bottom-bar-safe-area.test.ts`, `MainLayout.test.tsx`.

## Not done

See the owner's follow-up list in STATUS.md.
