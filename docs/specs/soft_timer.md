# Soft Timer Specification

## Overview

The "Soft Timer" feature ensures that active bidding extends the auction duration, preventing "sniping" (placing a bid at the very last second to win without giving others a chance to react).

## Behavior

### Trigger Condition

- **Action**: A user places a valid bid (amount > current highest bid).
- **Timing**: The bid is placed when the remaining time is less than **100 seconds**.

### Effect

- **Extension**: The auction deadline is extended by **60 seconds**.
- **Visual Feedback**: The countdown timer in the UI updates immediately to reflect the new deadline.

### Edge Cases

- **Multiple Bids**: If multiple bids are placed within the soft timer window, each bid extends the time (current implementation extends from the _current_ deadline, so it pushes it further).
- **Auction Ended**: Bids cannot be placed after the auction has ended (handled by existing logic, though soft timer logic checks `remaining > 0`).

## Data Model Changes

- **Frontend State**: The `deadline` is now managed in the component state (React `useState`) rather than being a static value or derived solely from props/API.

## UI/UX

- The timer display (`timeLeft`) automatically updates.
- No specific toast or alert is required by the initial request, but the timer jump provides visual feedback.
