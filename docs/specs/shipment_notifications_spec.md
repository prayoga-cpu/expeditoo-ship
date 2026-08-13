# Shipment Notifications Specification

**Version:** 1.0  
**Status:** Implementing  
**Created:** 2025-12-11

---

## 1. Overview

This specification defines which notifications should be sent during shipment lifecycle events.

---

## 2. Notification Events

### 2.1 Shipment Cancelled

**Trigger:** `shipmentService.cancelShipment()`  
**Recipients:** All parties except the canceller

| Recipient | Condition              | Type       | Title                | Message                                               |
| --------- | ---------------------- | ---------- | -------------------- | ----------------------------------------------------- |
| Driver    | If assigned            | `delivery` | "Shipment Cancelled" | "A shipment you were assigned to has been cancelled." |
| Buyer     | If cancelled by seller | `delivery` | "Shipment Cancelled" | "The seller has cancelled the shipment."              |
| Seller    | If cancelled by buyer  | `delivery` | "Shipment Cancelled" | "The buyer has cancelled the shipment."               |

**Link:** `/deliveries/{shipmentId}`

---

### 2.2 New Proposal Submitted

**Trigger:** `shipmentService.createProposal()`  
**Recipients:** Shipment owner (buyer & seller)

| Recipient | Condition | Type       | Title                 | Message                                                |
| --------- | --------- | ---------- | --------------------- | ------------------------------------------------------ |
| Buyer     | Always    | `delivery` | "New Driver Proposal" | "A driver has submitted a proposal for €{price}."      |
| Seller    | Always    | `delivery` | "New Driver Proposal" | "A driver has submitted a proposal for your shipment." |

**Link:** `/deliveries/{shipmentId}`

---

### 2.3 Proposal Accepted (Driver Assigned)

**Trigger:** `shipmentService.acceptProposal()`  
**Recipients:** Driver who was accepted, other drivers who proposed

| Recipient       | Condition            | Type       | Title                   | Message                                                        |
| --------------- | -------------------- | ---------- | ----------------------- | -------------------------------------------------------------- |
| Accepted Driver | Always               | `delivery` | "Proposal Accepted! 🎉" | "Your proposal has been accepted. Please proceed with pickup." |
| Other Drivers   | Had pending proposal | `delivery` | "Proposal Not Selected" | "Another driver was selected for this shipment."               |

**Link (Accepted):** `/driver/shipments/{shipmentId}`  
**Link (Rejected):** `/driver/deliveries`

---

### 2.4 Proof of Delivery Uploaded

**Trigger:** `shipmentService.uploadProofOfDelivery()`  
**Recipients:** Buyer & Seller

| Recipient | Condition | Type       | Title                    | Message                                                          |
| --------- | --------- | ---------- | ------------------------ | ---------------------------------------------------------------- |
| Buyer     | Always    | `delivery` | "Delivery Confirmed! ✅" | "Your package has been delivered. Review the proof of delivery." |
| Seller    | Always    | `delivery` | "Delivery Confirmed! ✅" | "The package has been delivered successfully."                   |

**Link:** `/deliveries/{shipmentId}`

---

## 3. Implementation Notes

### 3.1 Import Required

```typescript
import { notificationsDal } from "../dal/notifications.dal";
```

### 3.2 Error Handling

All notification sends should be wrapped in try-catch to prevent main flow interruption:

```typescript
try {
  await notificationsDal.create({...});
} catch (error) {
  console.error("Failed to send notification:", error);
}
```

### 3.3 Data in Notifications

Use the `data` field to store context:

```typescript
{
  data: {
    resourceId: shipmentId,
    resourceType: "shipment",
  }
}
```

---

## 4. Future Enhancements (Out of Scope)

- Push notifications (FCM/APNs)
- Email notifications
- SMS notifications
- Status change notifications (PICKED_UP, IN_TRANSIT)
- Notification preferences per user
