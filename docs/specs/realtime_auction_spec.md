# Realtime Auction Simulation Spec

## Overview

Simulate a realtime auction environment on the frontend without backend integration, providing a dynamic user experience that mimics live bidding and time extensions.

## Features

### 1. Live Bidding Simulation

- **Behavior**: Competitor bids are simulated to appear automatically without page refresh.
- **Frequency**: Approximately 40% chance of a new bid every 3 seconds.
- **Data Updates**:
  - New bids are added to the top of the bid history.
  - Current highest bid price updates automatically.
  - Bidder names and avatars are randomized.

### 2. Soft Timer (Anti-Sniping)

- **Condition**: Triggered when ANY bid (user or competitor) is placed.
- **Threshold**: If the remaining time is less than 100 seconds.
- **Action**: The auction deadline is extended by 60 seconds.
- **UI Update**: The countdown timer reflects the new deadline immediately.

### 3. Visual Feedback

- **Live Indicator**: The "Live Auction" badge pulses (using `animate-pulse`) to indicate active status.
- **Timer**: Displays countdown in `HHh MMm SSs` format.

## Implementation Details

- **Hook**: `useAuctionDetail.ts` manages the simulation logic using `setInterval` and `useEffect`.
- **State**: `deadline` state is shared and updated by both user actions and the simulation effect.
- **Consistency**: Competitor simulation uses functional state updates to ensure access to the latest `deadline` and `bids` without stale closures.
