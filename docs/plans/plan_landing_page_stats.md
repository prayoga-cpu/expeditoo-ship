# Plan: Landing Page Statistics Section

**Feature:** Landing Page Statistics Display  
**Status:** Planning  
**Priority:** Medium  
**Estimated Complexity:** 3/10

---

## Overview

Add a statistics section to the landing page to showcase platform credibility and growth metrics. This will display key numbers like total deliveries, verified drivers, active auctions, and satisfied users.

---

## Goals

1. Display platform statistics in an engaging, visually appealing format
2. Use mock data (backend not implemented yet)
3. Follow existing design system and branding
4. Ensure mobile responsiveness
5. Add subtle animations for visual interest

---

## Requirements Reference

From user requirements:

- **Statistik** (barang terkirim, driver terverifikasi, dll)

From `docs/roadmap.md`:

- Phase 1.1: Landing Page UI - All sections marked as complete, but statistics missing

---

## Implementation Approach

### 1. Create Statistics Component

**File:** `src/features/marketing/ui/LandingStats.tsx`

**Features:**

- Display 4 key metrics in a grid layout
- Use icons from `lucide-react`
- Animated counter effect (optional, using framer-motion)
- Responsive design (1 column mobile, 2-4 columns desktop)
- Consistent with existing landing page design

**Mock Data:**

- Total Deliveries: 50,000+
- Verified Drivers: 2,500+
- Active Auctions: 1,200+
- Satisfied Users: 15,000+

### 2. Update Landing Page

**File:** `src/app/(marketing)/page.tsx`

**Changes:**

- Import `LandingStats` component
- Add between `LandingHero` and `LandingHowItWorks` sections
- Maintain existing layout structure

### 3. Export Component

**File:** `src/features/marketing/ui/index.ts`

**Changes:**

- Add `LandingStats` to exports

---

## Files to Create/Modify

### New Files:

1. `src/features/marketing/ui/LandingStats.tsx` - Statistics component
2. `docs/specs/landing_page_stats_spec.md` - Specification document

### Modified Files:

1. `src/app/(marketing)/page.tsx` - Add stats section
2. `src/features/marketing/ui/index.ts` - Export new component

---

## Design Decisions

### Layout

- Grid layout: 1 column (mobile) → 2 columns (tablet) → 4 columns (desktop)
- Centered alignment
- Consistent spacing with other sections

### Visual Style

- Card-based design matching existing components
- Primary color accents for numbers
- Icons to represent each metric
- Subtle hover effects

### Animation

- Use `framer-motion` for scroll-triggered animations (already used in other components)
- Fade-in effect when section enters viewport
- Optional: Counting animation for numbers

### Metrics to Display

1. **Package Icon** - Total Deliveries Completed
2. **Users Icon** - Verified Drivers
3. **Gavel Icon** - Active Auctions
4. **Star Icon** - Satisfied Users

---

## Implementation Steps

1. **Create Spec** (`docs/specs/landing_page_stats_spec.md`)
   - Define exact behavior
   - Specify responsive breakpoints
   - Document mock data structure

2. **Build Component** (`LandingStats.tsx`)
   - Create component structure
   - Add mock data
   - Implement responsive grid
   - Add animations

3. **Integrate Component**
   - Update landing page
   - Update exports
   - Test responsive behavior

4. **Visual Verification**
   - Run dev server
   - Check desktop layout
   - Check mobile layout
   - Verify animations

---

## Dependencies

- `lucide-react` - Icons (already installed)
- `framer-motion` - Animations (already installed)
- `tailwindcss` - Styling (already configured)

---

## Testing Checklist

- [ ] Component renders without errors
- [ ] Responsive layout works on all breakpoints
- [ ] Animations trigger on scroll
- [ ] Consistent with design system
- [ ] No console errors
- [ ] Accessible (proper semantic HTML)

---

## Future Enhancements (Post-Backend)

When backend is implemented:

- Replace mock data with real-time statistics from API
- Add live counter updates
- Cache statistics data
- Add admin dashboard to view/update stats

---

## Notes

- Following YAGNI principle: Using mock data until backend is ready
- Following KISS principle: Simple, focused component
- Following existing patterns in `LandingAdvantages.tsx` and `LandingHowItWorks.tsx`
- No new dependencies required
