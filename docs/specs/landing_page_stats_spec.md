# Specification: Landing Page Statistics Section

**Feature:** Landing Page Statistics Display  
**Version:** 1.0  
**Last Updated:** 2025-11-28

---

## 1. Overview

This specification defines the exact behavior and appearance of the statistics section on the landing page. The section displays platform metrics to build credibility and trust with visitors.

---

## 2. Component Specification

### 2.1 Component Name

`LandingStats`

### 2.2 Location

- **File Path:** `src/features/marketing/ui/LandingStats.tsx`
- **Page Integration:** `src/app/(marketing)/page.tsx`
- **Position:** Between `<LandingHero />` and `<LandingHowItWorks />`

---

## 3. Visual Design

### 3.1 Section Layout

```
┌─────────────────────────────────────────────────────┐
│                  Section Container                   │
│  ┌───────────────────────────────────────────────┐  │
│  │         Background with gradient              │  │
│  │  ┌─────────────────────────────────────────┐ │  │
│  │  │  [Stat 1] [Stat 2] [Stat 3] [Stat 4]   │ │  │
│  │  │   Icon      Icon      Icon      Icon    │ │  │
│  │  │  Number    Number    Number    Number   │ │  │
│  │  │  Label     Label     Label     Label    │ │  │
│  │  └─────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 3.2 Responsive Breakpoints

| Breakpoint              | Grid Columns | Gap        |
| ----------------------- | ------------ | ---------- |
| Mobile (< 640px)        | 1            | 6 (1.5rem) |
| Tablet (640px - 1023px) | 2            | 8 (2rem)   |
| Desktop (≥ 1024px)      | 4            | 8 (2rem)   |

### 3.3 Spacing

- **Section Padding (Y-axis):** `py-16` (4rem top/bottom)
- **Container Padding (X-axis):** `px-4` (1rem left/right)
- **Card Padding:** `p-6` (1.5rem all sides)
- **Gap between elements:** `gap-8` (2rem)

---

## 4. Data Structure

### 4.1 Statistics Array (Mock Data)

```typescript
interface Statistic {
  icon: LucideIcon;
  value: string;
  label: string;
  color: string;
}

const statistics: Statistic[] = [
  {
    icon: Package,
    value: "50,000+",
    label: "Deliveries Completed",
    color: "blue",
  },
  {
    icon: Users,
    value: "2,500+",
    label: "Verified Drivers",
    color: "green",
  },
  {
    icon: Gavel,
    value: "1,200+",
    label: "Active Auctions",
    color: "purple",
  },
  {
    icon: Star,
    value: "15,000+",
    label: "Satisfied Users",
    color: "yellow",
  },
];
```

### 4.2 Color Mapping

```typescript
const iconColors: { [key: string]: string } = {
  blue: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  green: "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400",
  purple:
    "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
  yellow:
    "bg-yellow-100 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400",
};
```

---

## 5. Component Behavior

### 5.1 Initial State

- Component is hidden (opacity: 0, y: 50)
- Not visible until scrolled into viewport

### 5.2 Animation Trigger

- **Trigger:** When section enters viewport
- **Threshold:** 50% of section visible (`amount: 0.5`)
- **Behavior:** Fade in + slide up animation
- **Duration:** 0.8s with spring animation
- **Stagger:** Each card animates with 0.1s delay

### 5.3 Animation Specification

```typescript
const cardVariants = {
  offscreen: {
    y: 50,
    opacity: 0,
  },
  onscreen: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      bounce: 0.4,
      duration: 0.8,
    },
  },
};
```

### 5.4 Hover Effects

- **Card:** Subtle lift effect (`hover:-translate-y-2`)
- **Shadow:** Enhanced shadow on hover (`hover:shadow-2xl`)
- **Border:** Border color changes to primary (`hover:border-primary/50`)
- **Transition:** All transitions use `duration-300`
  className="group p-6 rounded-2xl border border-border bg-card transition-all duration-300 h-full transform hover:-translate-y-2 hover:shadow-2xl hover:border-primary/50 text-center"

````

### 6.4 Icon Container

```css
className="w-16 h-16 rounded-full flex items-center justify-center mb-4 mx-auto ${iconColors[stat.color]}"
````

### 6.5 Value Text

```css
className="text-4xl md:text-5xl font-bold text-foreground mb-2"
```

### 6.6 Label Text

```css
className="text-muted-foreground text-sm md:text-base"
```

---

## 7. Accessibility Requirements

### 7.1 Semantic HTML

- Use `<section>` for main container
- Use proper heading hierarchy (no heading needed for this section)
- Use `<div>` for stat cards

### 7.2 ARIA Attributes

- No interactive elements, so no ARIA required
- Ensure text contrast meets WCAG AA standards

### 7.3 Screen Reader Support

- All text must be readable by screen readers
- Icon decorative role (text provides context)

---

## 8. Integration Specification

### 8.1 Page Integration

**File:** `src/app/(marketing)/page.tsx`

**Before:**

```tsx
<main>
  <LandingHero />
  <LandingHowItWorks />
  ...
</main>
```

**After:**

```tsx
<main>
  <LandingHero />
  <LandingStats />
  <LandingHowItWorks />
  ...
</main>
```

### 8.2 Export Integration

**File:** `src/features/marketing/ui/index.ts`

**Add:**

```typescript
export { LandingStats } from "./LandingStats";
```

---

## 9. Edge Cases

### 9.1 No JavaScript

- Component should still render (no JS-dependent layout)
- Animations won't work, but content remains visible

### 9.2 Slow Network

- Component renders immediately (no external data)
- Icons load from bundle (no network request)

### 9.3 Dark Mode

- All colors must have dark mode variants
- Use Tailwind's `dark:` prefix for dark mode styles

### 9.4 Very Small Screens (< 320px)

- Single column layout maintained
- Text sizes remain readable
- No horizontal overflow

---

## 10. Performance Requirements

### 10.1 Rendering

- Component must render in < 16ms (60fps)
- No layout shifts (CLS = 0)

### 10.2 Animation

- Use GPU-accelerated properties only (transform, opacity)
- No janky animations (maintain 60fps)

### 10.3 Bundle Size

- No new dependencies required
- Component size < 5KB (gzipped)

---

## 11. Validation Rules

### 11.1 Data Validation

- All statistic values must be strings
- All labels must be non-empty strings
- All icons must be valid Lucide icons
- All colors must exist in color mapping

### 11.2 Type Safety

```typescript
// All props must be properly typed
// No 'any' types allowed
// Use TypeScript strict mode
```

---

## 12. Error Scenarios

### 12.1 Missing Icon

**Scenario:** Icon import fails  
**Expected Behavior:** Component should not render that stat  
**Mitigation:** Use try-catch or optional chaining

### 12.2 Invalid Color

**Scenario:** Color not in mapping  
**Expected Behavior:** Fallback to default color (blue)  
**Implementation:** Use `iconColors[stat.color] || iconColors.blue`

---

## 13. Testing Criteria

### 13.1 Visual Testing

- [ ] Component renders on landing page
- [ ] All 4 statistics display correctly
- [ ] Icons render properly
- [ ] Numbers are formatted correctly
- [ ] Labels are readable

### 13.2 Responsive Testing

- [ ] Mobile (375px): 1 column layout
- [ ] Tablet (768px): 2 column layout
- [ ] Desktop (1024px): 4 column layout
- [ ] No horizontal scroll on any breakpoint

### 13.3 Animation Testing

- [ ] Fade-in triggers on scroll
- [ ] Cards animate with stagger effect
- [ ] Hover effects work smoothly
- [ ] No animation jank

### 13.4 Accessibility Testing

- [ ] Keyboard navigation (not applicable - no interactive elements)
- [ ] Screen reader announces all text
- [ ] Color contrast passes WCAG AA
- [ ] Works without JavaScript

---

## 14. Future Enhancements

### 14.1 Backend Integration (Phase 2)

When backend is implemented:

- Replace mock data with API call
- Add loading state
- Add error handling
- Cache statistics data

### 14.2 Advanced Features

- Animated counting effect (numbers count up)
- Real-time updates via WebSocket
- Admin configurable statistics
- A/B testing different metrics

---

## 15. Dependencies

### 15.1 Required Packages (Already Installed)

- `lucide-react` - Icons
- `framer-motion` - Animations
- `tailwindcss` - Styling
- `next` - Framework
- `react` - Library

### 15.2 No New Dependencies Required

All functionality can be implemented with existing packages.

---

## 16. Acceptance Criteria

✅ **Definition of Done:**

1. Component created in correct location
2. All 4 statistics display correctly
3. Responsive layout works on all breakpoints
4. Animations trigger smoothly
5. Integrated into landing page
6. Exported from index.ts
7. No TypeScript errors
8. No console warnings
9. Follows existing design patterns
10. Matches visual design of other landing sections

---

## 17. Notes

- This is a **UI-only** implementation (mock data)
- Backend integration will be handled in Phase 2
- Component follows existing patterns from `LandingAdvantages.tsx`
- Uses same animation library and approach as other sections
- Maintains consistency with design system
