# Specification: Shipment Role Filter (Buyer/Seller)

## Overview

Extension to the Shipment API that allows filtering shipments based on the user's **role** in the transaction (buyer or seller) rather than just ownership.

---

## API Changes

### GET /api/shipments

**Updated Query Parameters:**

| Param  | Type   | Required | Description                                                                                            |
| ------ | ------ | -------- | ------------------------------------------------------------------------------------------------------ |
| role   | enum   | No       | Filter by user's role. Values: `sender`, `driver`, `available`, `proposals`, **`buyer`**, **`seller`** |
| status | string | No       | Filter by shipment status                                                                              |
| limit  | number | No       | Pagination limit (default: 20)                                                                         |
| offset | number | No       | Pagination offset (default: 0)                                                                         |

---

## Role Definitions

### `buyer` Role

Returns shipments where the authenticated user is the **buyer/winner** of the associated listing.

**Query Logic:**

```sql
SELECT s.* FROM shipments s
WHERE
  -- User won the listing associated with this shipment
  EXISTS (
    SELECT 1 FROM listings l
    WHERE l.id = s.listing_id
    AND l.winner_id = :userId
  )
  -- OR user directly created the shipment (for non-listing shipments)
  OR s.user_id = :userId
```

**Use Case:** "Incoming" tab - Items the user is expecting to receive.

---

### `seller` Role

Returns shipments where the authenticated user is the **seller/auctioneer** of the associated listing.

**Query Logic:**

```sql
SELECT s.* FROM shipments s
WHERE EXISTS (
  SELECT 1 FROM listings l
  WHERE l.id = s.listing_id
  AND l.seller_id = :userId
)
```

**Use Case:** "Outgoing" tab - Items the user has sold and is sending out.

---

## Frontend Mapping

| Frontend Type | Backend Role | Description                               |
| ------------- | ------------ | ----------------------------------------- |
| `incoming`    | `buyer`      | Shipments where user is buyer             |
| `outgoing`    | `seller`     | Shipments where user is seller            |
| `driver`      | `driver`     | Shipments assigned to driver              |
| `available`   | `available`  | Pending shipments for driver marketplace  |
| `proposals`   | `proposals`  | Shipments where driver submitted proposal |

---

## Response Format

No changes to response format. Same as existing `/api/shipments` response:

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "status": "PENDING",
      "originAddress": "...",
      "destinationAddress": "...",
      "listing": { "id": "...", "title": "...", "image": "..." },
      "driver": null,
      "createdAt": "..."
    }
  ],
  "pagination": {
    "total": 10,
    "limit": 20,
    "offset": 0
  }
}
```

---

## Validation Rules

1. `role` must be one of: `sender`, `driver`, `available`, `proposals`, `buyer`, `seller`
2. If invalid role provided, return 400 with `VALIDATION_ERROR`
3. User must be authenticated to access any role-filtered data

---

## Edge Cases

| Scenario                                             | Expected Behavior                            |
| ---------------------------------------------------- | -------------------------------------------- |
| User has no listings sold                            | Empty array for `role=seller`                |
| User has no auctions won                             | Empty array for `role=buyer`                 |
| Shipment not linked to listing (`listing_id` = null) | Only appears in `buyer` if `user_id` matches |
| User is both buyer and seller on platform            | Different results for each role              |

---

## Error Responses

**400 - Invalid Role:**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameters",
    "details": {
      "role": ["Invalid enum value"]
    }
  }
}
```

---

## Implementation Notes

1. **Performance:** Uses SQL subqueries with EXISTS for efficient filtering
2. **Backwards Compatibility:** Default role remains `sender` if not specified
3. **Listing Relation Required:** For buyer/seller roles to work properly, shipments should have valid `listing_id`

---

## Related Documents

- [Plan: Shipment Role Filter](../plans/plan_shipment_role_filter.md)
- [Shipment API Spec](./shipment_spec.md)
- [Deliveries Spec](./deliveries_spec.md)
