# Expeditoo API Specification

## 1. Standard Response Format

All API responses must follow this standard format.

### Success Response

```json
{
  "success": true,
  "data": { ... }, // The actual data payload
  "message": "Operation successful" // Optional
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE", // e.g., VALIDATION_ERROR, NOT_FOUND, UNAUTHORIZED
    "message": "Human readable error message",
    "details": { ... } // Optional validation errors or additional context
  }
}
```

---

## 2. Authentication (Better Auth)

_Note: These are handled by the `better-auth` library, but listed here for reference._

- `POST /api/auth/sign-in/email` - Sign in with email/password
- `POST /api/auth/sign-up/email` - Sign up with email/password
- `POST /api/auth/sign-out` - Sign out
- `GET /api/auth/session` - Get current session

---

## 3. Users

### Get Current User Profile

- **GET** `/api/users/me`
- **Response**: `User` object with roles

### Update Profile

- **PATCH** `/api/users/me`
- **Body**: `{ name, image, ... }`
- **Response**: Updated `User` object

### Get User Public Profile

- **GET** `/api/users/:id`
- **Response**: Public user info (name, image, rating, join date)

---

## 4. Listings (Items)

### Create Listing

- **POST** `/api/listings`
- **Body**:
  {
  "title": "Vintage Camera",
  "description": "A beautiful vintage camera...",
  "categoryId": "electronics",
  "condition": "used_good",
  "images": ["url1", "url2"],
  "type": "auction", // or "direct_sale"
  "startPrice": 100, // Starting price
  "buyNowPrice": 200, // Optional
  "auctionDuration": "7", // Days
  "length": 10, // cm
  "width": 10, // cm
  "height": 10, // cm
  "weight": "0-5", // kg range
  "size": "S", // XS, S, M, L, XL, XXL
  "location": {
  "lat": -6.2,
  "lng": 106.8,
  "address": "Jalan Sudirman No. 1",
  "city": "Jakarta",
  "country": "Indonesia",
  "postalCode": "12190"
  }
  }

  ```

  ```

- **Response**: Created `Listing` object

### Get Public Listings (Search & Filter)

- **GET** `/api/listings/public`
- **Query Params**: `page`, `limit`, `category`, `search`, `minPrice`, `maxPrice`, `lat`, `lng`, `radius`, `sortBy`
- **Response**: `{ success: true, data: Listing[] }`
- **Note**: The `search` parameter now utilizes PostgreSQL Full‑Text Search with a GIN index (`listing_search_idx`). Supports phrase search, boolean operators, and relevance ranking (matches in title are ranked higher).

### Get My Listings (Seller)

- **GET** `/api/listings`
- **Response**: `{ success: true, data: Listing[] }`

### Get Listing Details

- **GET** `/api/listings/:id`
- **Response**: `Listing` object with Seller info

### Update Listing

- **PATCH** `/api/listings/:id`
- **Body**: Partial listing fields
- **Response**: Updated `Listing` object

### Delete Listing

- **DELETE** `/api/listings/:id`
- **Response**: `{ success: true }`

---

## 5. Auctions & Bids

### Place Bid

- **POST** `/api/auctions/:listingId/bid`
- **Body**: `{ "amount": 150 }`
- **Response**: `Bid` object

### Get Bids for Listing

- **GET** `/api/auctions/:listingId/bids`
- **Response**: `Bid[]` (ordered by amount desc)

---

## 6. Shipments (Logistics)

### Create Shipment Request

- **POST** `/api/shipments`
- **Body**:
  ```json
  {
    "listingId": "...", // Optional, if linked to a purchase
    "origin": { "lat": ..., "lng": ..., "address": ... },
    "destination": { "lat": ..., "lng": ..., "address": ... },
    "packageDetails": { "weight": 5, "dimensions": "10x10x10", "description": "..." },
    "scheduledDate": "2023-12-25T10:00:00Z"
  }
  ```
- **Response**: `Shipment` object

### Get Shipments (Driver/User)

- **GET** `/api/shipments`
- **Query Params**: `status`, `role` (driver/sender)
- **Response**: `Shipment[]`

### Submit Proposal (Driver)

- **POST** `/api/shipments/:id/proposals`
- **Body**: `{ "price": 50000, "estimatedPickup": "...", "estimatedDelivery": "..." }`
- **Response**: `Proposal` object

### Accept Proposal (User)

- **POST** `/api/shipments/:id/proposals/:proposalId/accept`
- **Response**: Updated `Shipment` object (status: ASSIGNED)

### Update Shipment Status (Driver)

- **PATCH** `/api/shipments/:id/status`
- **Body**: `{ "status": "PICKED_UP" }` // PENDING, ASSIGNED, PICKED_UP, IN_TRANSIT, DELIVERED
- **Response**: Updated `Shipment` object

---

## 7. Messages (Chat)

### Get Conversations

- **GET** `/api/messages/conversations`
- **Response**: `Conversation[]` (with last message and unread count)

### Get Messages

- **GET** `/api/messages/conversations/:conversationId`
- **Query Params**: `cursor` (for pagination)
- **Response**: `Message[]`

### Send Message

- **POST** `/api/messages`
- **Body**:
  ```json
  {
    "conversationId": "...", // OR "recipientId" to start new
    "content": "Hello, is this available?",
    "listingId": "..." // Optional context
  }
  ```
- **Response**: `Message` object
- **Note**: Messages are text-only. Photo uploads are not supported.

---

## 8. Reviews

The Review system supports **polymorphic reviews** for two transaction types:

1.  **Listing Reviews**: Buyer ↔ Seller reviews after an item sale.
2.  **Shipment Reviews**: Client ↔ Driver reviews after a delivery.

### Create Review

- **POST** `/api/reviews`
- **Auth Required**: Yes
- **Body**:
  ```json
  {
    "targetUserId": "user_abc",
    "rating": 5,
    "comment": "Great experience!", // Optional (max 1000 chars)
    "listingId": "listing_xyz",     // Required if reviewing a Listing transaction
    "shipmentId": "shipment_123"    // Required if reviewing a Shipment transaction
  }
  ```
- **Validation Rules**:
  - Must provide **either** `listingId` **OR** `shipmentId` (XOR - not both, not neither).
  - **Listing Context**:
    - Listing status must be `sold` or Order status must be `delivered`/`paid`.
    - `authorId` must be the **Buyer** (winner) or **Seller** (owner).
    - Buyer reviews Seller, Seller reviews Buyer.
  - **Shipment Context**:
    - Shipment status must be `DELIVERED`.
    - `authorId` must be the **Client** (shipment creator) or **Driver** (assigned driver).
    - Client reviews Driver, Driver reviews Client.
  - User can only review a specific transaction **once**.
- **Response (Success 201)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "review_xyz",
      "authorId": "...",
      "targetUserId": "...",
      "rating": 5,
      "comment": "...",
      "role": "buyer", // "buyer" | "seller" | "client" | "driver"
      "listingId": "...",
      "shipmentId": null,
      "createdAt": "..."
    }
  }
  ```
- **Possible Errors**:
  - `400 BAD_REQUEST`: Invalid input, missing context, or invalid target.
  - `403 NOT_AUTHORIZED`: User is not a participant in the transaction.
  - `409 ALREADY_REVIEWED`: User has already reviewed this transaction.
  - `412 PRECONDITION_FAILED`: Transaction is not yet complete.

### Get User Reviews

- **GET** `/api/users/:id/reviews`
- **Query Params**: `page` (default 1), `limit` (default 10, max 50), `type` (all | buyer | seller | driver | client)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "...",
          "rating": 5,
          "comment": "...",
          "createdAt": "...",
          "role": "buyer",
          "author": { "id": "...", "name": "...", "image": "..." },
          "listing": { "id": "...", "title": "..." }, // or null
          "shipment": { "id": "..." } // or null
        }
      ],
      "total": 25,
      "page": 1,
      "limit": 10,
      "totalPages": 3
    }
  }
  ```

### Get Listing Reviews

- **GET** `/api/listings/:id/reviews`
- **Response**: `Review[]` (all reviews associated with a specific listing)

---

## 9. Admin

_Note: All Admin endpoints require admin role authentication._

### Get Dashboard Stats

- **GET** `/api/admin/stats`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "kpi": {
        "totalRevenue": { "value": 452318900, "changePercentage": 20.1 },
        "activeUsers": { "value": 2350, "changePercentage": 180.1 },
        "activeDrivers": { "value": 45, "changePercentage": 12 },
        "pendingDeliveries": { "value": 12, "changePercentage": -4 }
      },
      "charts": {
        "revenue": [
          { "name": "Jan", "total": 120000 },
          { "name": "Feb", "total": 210000 }
        ]
      }
    }
  }
  ```

### Get Recent Activity

- **GET** `/api/admin/activity`
- **Response**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "...",
        "user": "Alice Johnson",
        "action": "listed a new item",
        "target": "Vintage Camera",
        "time": "2023-12-06T01:00:00Z",
        "avatar": "AJ"
      }
    ]
  }
  ```

### Update User Status

- **PATCH** `/api/admin/users/:id/status`
- **Body**: `{ "banned": true }`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "id": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "banned": true,
      "updatedAt": "2023-12-06T01:00:00Z"
    },
    "message": "User has been suspended"
  }
  ```

### Get Users List

- **GET** `/api/admin/users`
- **Query Params**: `page`, `pageSize`, `search`, `role`
- **Response**: `{ success: true, data: { users: User[], total, page, pageSize, totalPages } }`

- **Response**:
  ```json
  {
    "success": true,
    "message": "User status updated successfully"
  }
  ```

### User Management

#### Manage User Roles
- **POST** `/api/user/roles`
- **Access**: Admin Only
- **Body**:
  ```json
  {
    "userId": "string",
    "role": "buyer | transporter | admin",
    "replace": true // Optional, replace existing roles
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "User role updated successfully"
  }
  ```

#### Moderate User
- **POST** `/api/admin/users/:id/status`
- **Access**: Admin Only
- **Body**:
  ```json
  {
    "banned": true // or false
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "User status updated successfully"
  }
  ```

### Payments & Refunds

#### Get Payments List
- **GET** `/api/admin/payments`
- **Access**: Admin Only
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "...",
          "amount": 5000,
          "currency": "EUR",
          "status": "succeeded",
          "userName": "John Doe",
          "userEmail": "john@example.com",
          "createdAt": "..."
        }
      ],
      "total": 1
    }
  }
  ```

#### Process Refund
- **POST** `/api/admin/refunds`
- **Access**: Admin Only
- **Body**:
  ```json
  {
    "paymentId": "payment_id",
    "reason": "requested_by_customer" // duplicate | fraudulent | requested_by_customer
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": { "refund": { ... } },
    "message": "Refund processed successfully"
  }
  ```

---

## 10. Real-time (Ably)

_Status: ✅ Implemented & Active_

The real-time system uses Ably to push events to connected clients. Clients must authenticate to receive a secure token.

### Get Ably Token

Generates a secure Ably TokenRequest for client-side real-time connections.

- **GET** `/api/ably/auth`
- **Auth Required**: Yes (better-auth session)
- **Response (Success)**:
  ```json
  {
    "success": true,
    "data": {
      "keyName": "appId.keyName",
      "timestamp": 1702400000000,
      "nonce": "abc123...",
      "clientId": "user_id_here",
      "capability": "{\"*\":[\"*\"]}",
      "mac": "base64_signature..."
    }
  }
  ```
- **Response (Error - Unauthorized)**:
  ```json
  {
    "success": false,
    "error": {
      "code": "UNAUTHORIZED",
      "message": "Authentication required to access real-time features"
    }
  }
  ```
- **Response (Error - Server Error)**:
  ```json
  {
    "success": false,
    "error": {
      "code": "ABLY_AUTH_ERROR",
      "message": "Failed to generate real-time authentication token"
    }
  }
  ```

### Real-time Event Channels

| Channel Pattern                 | Purpose                       | Events                        |
| ------------------------------- | ----------------------------- | ----------------------------- |
| `user:{userId}:notifications`   | Private user notifications    | `notification:new`            |
| `user:{userId}:messages`        | Private message badge updates | `badge:update`                |
| `conversation:{conversationId}` | Private 1-on-1 chat room      | `message:new`, `message:read` |
| `listing:{listingId}:bids`      | Public auction bid updates    | `bid:new`, `auction:ended`    |

### 11. Admin Support Chats

_Note: Requires Admin Role_

### Get Support Chats

- **GET** `/api/admin/support-chats`
- **Query Params**: `status` ("all" | "unread")
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "chats": [
        {
          "conversationId": "...",
          "type": "SUPPORT",
          "user": { ... },
          "lastMessage": { ... },
          "unreadCount": 2
        }
      ],
      "total": 10
    }
  }
  ```

### Start Support Chat (User)

- **POST** `/api/chat/support`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "chatRoomId": "...",
      "exists": boolean
    }
  }
  ```

---

## 12. User Preferences

### Get User Preferences

- **GET** `/api/user/preferences`
- **Auth Required**: Yes
- **Response**:
  ```json
  {
    "success": true,
    "preferences": {
      "notifications": {
        "messages": { "email": true, "inApp": true },
        "bids": { "email": true, "inApp": true },
        "orders": { "email": true, "inApp": true },
        "shipments": { "email": true, "inApp": true },
        "marketing": { "email": false, "inApp": false }
      }
    }
  }
  ```

### Update User Preferences

- **PATCH** `/api/user/preferences`
- **Auth Required**: Yes
- **Body**:
  ```json
  {
    "notifications": {
      "messages": { "email": true, "inApp": true }
    }
  }
  ```
- **Note**: Partial updates supported. Only provided fields are updated (deep merge).
- **Response**: Same as GET

---

## 13. Invoices

### Get User Invoices

- **GET** `/api/user/invoices`
- **Auth Required**: Yes
- **Query Params**: `page` (default 1), `limit` (default 10), `status` (draft | issued | paid | void)
- **Response**:
  ```json
  {
    "success": true,
    "items": [
      {
        "id": "...",
        "invoiceNumber": "INV-2024-0001",
        "paymentId": "...",
        "userId": "...",
        "amount": 12500,
        "currency": "EUR",
        "status": "paid",
        "issuedAt": "2024-12-20T10:00:00Z",
        "paidAt": "2024-12-20T10:05:00Z",
        "pdfUrl": "/api/user/invoices/xxx/pdf",
        "createdAt": "..."
      }
    ],
    "total": 25,
    "page": 1,
    "limit": 10,
    "totalPages": 3
  }
  ```

### Get Invoice Details

- **GET** `/api/user/invoices/:id`
- **Auth Required**: Yes
- **Response**: Single invoice object with full details

### Download Invoice PDF

- **GET** `/api/user/invoices/:id/pdf`
- **Auth Required**: Yes
- **Response**: PDF file download (Content-Type: application/pdf)
- **Note**: Generates PDF on-demand using @react-pdf/renderer

---

## 14. Payment History

### Get User Payments

- **GET** `/api/user/payments`
- **Auth Required**: Yes
- **Query Params**: `page` (default 1), `limit` (default 10), `status`
- **Response**:
  ```json
  {
    "success": true,
    "items": [
      {
        "id": "...",
        "amount": 12500,
        "currency": "EUR",
        "status": "succeeded",
        "stripePaymentIntentId": "pi_xxx",
        "paymentMethod": "card",
        "description": "Purchase: Vintage Camera",
        "createdAt": "...",
        "invoice": {
          "id": "...",
          "invoiceNumber": "INV-2024-0001",
          "pdfUrl": "/api/user/invoices/xxx/pdf"
        }
      }
    ],
    "total": 50,
    "page": 1,
    "limit": 10
  }
  ```

---

## 15. Transporters

### Get Available Transporters

- **GET** `/api/transporters`
- **Query Params**: `page`, `limit`, `minRating`, `vehicleType`, `zone`
- **Response**:
  ```json
  {
    "success": true,
    "items": [
      {
        "id": "...",
        "userId": "...",
        "vehicleType": "van",
        "vehiclePlate": "AB-123-CD",
        "capacityKg": 500,
        "serviceZones": ["Paris", "Île-de-France"],
        "isAvailable": true,
        "rating": 4.8,
        "totalDeliveries": 150,
        "completedDeliveries": 145,
        "user": {
          "id": "...",
          "name": "Jean Dupont",
          "image": "..."
        }
      }
    ],
    "total": 25,
    "page": 1,
    "limit": 10,
    "totalPages": 3
  }
  ```

---

## 16. Notifications

### Get User Notifications

- **GET** `/api/notifications`
- **Query Params**: `page`, `limit`
- **Response**: `Notification[]` with pagination

### Mark Notification as Read

- **PATCH** `/api/notifications/:id/read`
- **Response**: Updated notification

### Mark All Notifications as Read

- **POST** `/api/notifications/read-all`
- **Response**: `{ success: true, count: number }`

### Get Unread Count

- **GET** `/api/notifications/unread-count`
- **Response**: `{ count: number }`

