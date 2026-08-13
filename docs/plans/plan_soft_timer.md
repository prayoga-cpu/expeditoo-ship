# Plan: Soft Timer Implementation

## Goal

Implement a "soft timer" feature where the auction deadline extends if a bid is placed within the last 100 seconds.

## Changes

### `src/features/app/auction/hooks/useAuctionDetail.ts`

1.  **State Management for Deadline**:
    - Introduce a `deadline` state variable initialized to the mock deadline.
    - Update the `auction` object to use this state variable instead of a hardcoded value.

2.  **Soft Timer Logic**:
    - In `handlePlaceBid`, calculate the remaining time.
    - If `remainingTime < 100` seconds (100,000 ms):
      - Add 60 seconds (or a configurable amount) to the `deadline`.
      - Update the `deadline` state.

3.  **Timer Update**:
    - Ensure the countdown timer `useEffect` depends on the new `deadline` state.

4.  **Competitor Bids (Optional but good)**:
    - Apply the same logic to the simulated competitor bids to make the feature more robust and demonstrable without user interaction if they wait. (I will add this if it fits easily, but prioritize user action).

## Verification

- Wait for the timer to go below 100 seconds (might need to adjust the initial time for testing).
- Place a bid.
- Verify the time increases.
