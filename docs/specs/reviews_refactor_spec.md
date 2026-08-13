# Specification: Review System (Refactored)

## Overview
The Review System allows users to rate and comment on their interactions within the platform. Reviews build trust and reputation. The system must support reviews for **Item Transactions** (Buying/Selling) and **Logistics Services** (Shipping).

## Database Schema (`reviews`)

| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | `text` | PK | NanoID |
| `authorId` | `text` | FK `users.id` | The user writing the review |
| `targetUserId` | `text` | FK `users.id` | The user receiving the review |
| `rating` | `integer` | Not Null | 1 to 5 stars |
| `comment` | `text` | Nullable | Optional text feedback |
| `listingId` | `text` | FK `listings.id`, Nullable | Context: Item Transaction |
| `shipmentId` | `text` | FK `shipments.id`, Nullable | Context: Delivery Service |
| `role` | `enum` | Not Null | Role of the author in this transaction (`BUYER`, `SELLER`, `DRIVER`, `CLIENT`) |
| `createdAt` | `timestamp` | Default Now | |

**Constraints:**
- `listingId` and `shipmentId` cannot both be null.
- `listingId` and `shipmentId` cannot both be set (Atomic context).
- Unique constraint: `(authorId, listingId)` or `(authorId, shipmentId)` to prevent double reviews per transaction.

## API Specification

### 1. Create Review
**Endpoint**: `POST /api/reviews`

**Request Body (JSON)**:
```json
{
  "targetUserId": "user_123",
  "rating": 5,
  "comment": "Great service!",
  "listingId": "listing_abc", // Optional (Required if context is Item)
  "shipmentId": "ship_xyz",   // Optional (Required if context is Shipment)
}
```

**Validation Rules**:
1. **Authentication**: User must be logged in.
2. **Context**: Must provide either `listingId` OR `shipmentId`.
3. **Transaction Existence**: The Listing or Shipment must exist.
4. **Participation**: The `authorId` must be a participant in the transaction:
   - **Listing**: Winner (Buyer) OR Owner (Seller).
   - **Shipment**: Creator (Client) OR Assigned Driver.
5. **Completion**:
   - **Listing**: Status must be `SOLD` or associated Order status must be `DELIVERED` (if applicable).
   - **Shipment**: Status must be `DELIVERED`.
6. **Uniqueness**: User hasn't already reviewed this specific transaction.

**Response**:
- `201 Created`: Review object.
- `400 Bad Request`: Validation errors.
- `403 Forbidden`: Not a participant or transaction not complete.

### 2. Get User Reviews
**Endpoint**: `GET /api/users/[id]/reviews`

**Query Params**:
- `page`: number (default 1)
- `limit`: number (default 10)
- `type`: `all` | `as_seller` | `as_buyer` | `as_driver` (Filter by role)

## Business Logic Details

### Review Contexts

#### A. Listing Transaction (Item Sale)
- **Role: BUYER**
  - Author: The user who won the auction or bought the item.
  - Target: The seller.
- **Role: SELLER**
  - Author: The owner of the listing.
  - Target: The winner/buyer.
- **Requirement**: Listing status `SOLD` or Order status >= `PAID`.

#### B. Shipment Transaction (Logistics)
- **Role: CLIENT** (The one who paid for shipping)
  - Author: The user who created the shipment request.
  - Target: The assigned driver.
- **Role: DRIVER**
  - Author: The user assigned to the shipment.
  - Target: The client (shipment creator).
- **Requirement**: Shipment status `DELIVERED`.

## Future Considerations
- **Reply System**: Allow target users to reply to reviews.
- **Moderation**: Admin tools to hide inappropriate reviews.
