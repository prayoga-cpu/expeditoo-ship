# Spec: Help Pages

## 1. Overview

Add a static "Help" page to both the Main Application and the Driver Application to provide users with support information and FAQs.

## 2. Main Application Help Page

- **URL**: `/help`
- **Location**: `src/app/(app)/(main)/help/page.tsx`
- **Content**:
  - **Header**: "Help & Support"
  - **FAQ Section**: Accordion style FAQs (e.g., "How to track my order?", "How to contact seller?").
  - **Contact Section**: Email support (support@expeditoo.com) and phone number (dummy).
  - **Navigation**: Accessible via Footer (to be added later) or direct link.

## 3. Driver Application Help Page

- **URL**: `/driver/help`
- **Location**: `src/app/(app)/driver/help/page.tsx`
- **Content**:
  - **Header**: "Driver Support"
  - **FAQ Section**: Driver-specific FAQs (e.g., "How to accept a job?", "Payment issues").
  - **Contact Section**: Dedicated driver support contact.

## 4. Design

- Use `shadcn/ui` components (`Accordion`, `Card`, `Button`).
- Consistent with the rest of the application theme.
