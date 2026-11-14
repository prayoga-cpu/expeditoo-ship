# Route towns and blank streets — spec

Status: **current** (2.83.2). From the client's 2026-11-14 feedback on the
dashboard's « Course en cours » card and on the delivery block of a job page.

## 1. What was reported

1. « Pickup and delivery cities are missing in this screen » — the dashboard
   card read `13 RUE DU DEPART → 15 quai Francois Ier`, no town.
2. « Delivery address missing » — on the owner's own job page the delivery
   block said *« Adresse exacte communiquée aux transporteurs vérifiés »* above
   `64000 bayonne`.

## 2. Cause, and the rule

The street line of an end is **optional** since 2026-11-06 (A03: town and
postal code are the minimum), so `listings.dropoff_address` can be `""`.
A shipment copies **only that street line** at award, never the town.

- A card that prints `shipments.*_address` alone has no town, and prints
  nothing for a request posted without a street.
- The town is on the listing. `src/lib/route-label.ts` is the one place that
  composes it: `routeTowns` (« Marseille » → « Bayonne », for a row that
  truncates, street as the fallback) and `routeStops` (street + town, for a
  card that wraps; never a dangling comma).
- A `driver` is projected through `DRIVER_LISTING_FIELDS`, which carried no
  town, postal code, country, floor or lift — the client type declared them,
  the server never sent them. They are public listing columns, not a
  commercial term, and are added.

Surfaces changed: dashboard « Course en cours » (`routeStops`); driver
`ActiveShipments`, `MyShipments` and the requester's `DeliveryCard`
(`routeTowns`); the driver shipment page (street + town + country); the
shipment-update email's « Livraison à » line.

## 3. The job page: three states, never two

`Endpoint` receives the street as one of:

| Value | Meaning | Shown |
|---|---|---|
| `undefined` | the viewer's audience may not read it | « Adresse exacte communiquée aux transporteurs vérifiés. » |
| `""` | nobody typed one | « Adresse précise non renseignée. » — and, to the owner of an open direct request, « Ajoutez-la avec « Modifier ». » |
| text | the street | the street |

The two empty cases were one `address ? … : …` test, which told an owner that
their own request hid its address from them.

## 4. Decided, deliberately

An award is **not** blocked for want of a delivery street. A03 made it
optional on purpose; the carrier still gets the town, and a blank street is now
said plainly instead of mis-said.

## 5. Test coverage required

- `route-label.test.ts` — town and stop composition, blank street, fallback.
- `JobDetail.test.tsx` — owner, non-owner and withheld cases.
- `DeliveryCard.test.tsx` — towns, not streets.
- `shipment.service.test.ts` — a driver's listing carries the towns; the email
  has no dangling comma for a blank street.
