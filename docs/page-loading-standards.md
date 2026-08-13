# Unified Layout & Loading Standards

> **STATUS: ENFORCED**
> All layouts (Main, Admin, Driver) MUST strictly follow this structure to guarantee pixel-perfect consistency.

## 1. The Unified Layout Protocol (ULP)

To ensure the `PageLoader` and general content positioning are 100% identical across the entire application, all layouts must share the EXACT SAME DOM Structure.

### Required DOM Structure

```tsx
// Root Container MUST be h-screen
<div className="flex h-screen bg-background">
  // Sidebar MUST be static (hidden on mobile, flex on desktop)
  <aside className="hidden xl:flex w-64 border-r bg-card flex-col">
    {/* Sidebar Content */}
  </aside>
  // Main Content Column
  <div className="flex-1 flex flex-col overflow-hidden">
    // Header MUST be sticky and fixed height (h-12) // MUST always be visible
    to maintain structural consistency
    <header className="border-b border-border bg-card sticky top-0 z-40">
      <div className="flex items-center justify-between px-4 md:px-6 py-2 h-12">
        {/* Header Content */}
      </div>
    </header>
    // Main Area MUST handle scrolling // MUST have padding bottom on mobile to
    clear Fixed Nav
    <main
      className="flex-1 overflow-y-auto overflow-x-hidden xl:pb-0"
      // CONDITIONALLY ADD pb-[88px] HERE IF NAV IS VISIBLE
      style={{ scrollbarGutter: "stable" }}
    >
      <div className="p-4 md:p-6">{children}</div>
    </main>
    // Bottom Navigation (Mobile Only) // MUST be 'fixed bottom-0' for robust
    mobile behavior // MUST have explicit height matching the padding
    <nav className="fixed bottom-0 left-0 right-0 z-50 ... h-[88px]">
      {/* Nav Content */}
    </nav>
  </div>
</div>
```

## 2. Fixed Dimensions Reference

To maintain consistency, the following dimensions are **HARDCODED** and standardized:

| Component     | Height               | Mobile Vis | Desktop Vis |
| ------------- | -------------------- | ---------- | ----------- |
| **Header**    | `h-12` (3rem / 48px) | Visible    | Visible     |
| **BottomNav** | `h-[88px]` (~5.5rem) | Visible\*  | Hidden      |
| **MainPad**   | `p-4`                | -          | -           |
| **DeskPad**   | `md:p-6`             | -          | -           |
| **NavPad**    | `pb-[88px]`          | On Main    | -           |

_\*BottomNav visibility may vary per route logic, but when visible, it MUST match these specs and have accompanying Main padding._

## 3. PageLoader Configuration

Because the layout structure is now unified, the CSS variables for the loader are simple and identical for everyone.

**In `page-loader.tsx`:**

```tsx
const heightMap = {
  // One source of truth.
  default:
    "min-h-[calc(100vh-var(--loader-offset-mobile,8.5rem))] xl:min-h-[calc(100vh-var(--loader-offset-desktop,7rem))]",
};
```

**In Layout Component:**

```tsx
style={{
  '--loader-offset-mobile': '8.5rem', // Header (3rem) + Nav (5.5rem)
  '--loader-offset-desktop': '7rem',  // Header + Padding buffer
}}
```

## 4. Forbidden Practices (Rules)

1. **NEVER use `relative`/`static` positioning for BottomNav**. It must be `fixed bottom-0` to avoid scrolling issues on mobile.
2. **NEVER forget the `pb-[88px]` compensation** on `main` when Nav is visible. Content will be hidden otherwise.
3. **NEVER hide Headers on Desktop** (`xl:hidden`). Even if Admin usually doesn't need a header, we show it for consistency.
4. **NEVER use `min-h-screen` on Layout Root**. Use `h-screen` + `overflow-hidden` to control scrolling behavior explicitly.

## 5. Troubleshooting

**"My navigation moves up when scrolling!"**

- **Cause:** You are using flow-based layout for BottomNav on mobile.
- **Fix:** Change BottomNav to `fixed bottom-0` and add `pb-[88px]` to main container.

**"My content is hidden behind the nav!"**

- **Cause:** Missing `pb-[88px]` on the main container.
- **Fix:** Add the padding.

**"My loader is too low/high!"**

- **Cause:** CSS variable offsets don't match the new dimensions.
- **Fix:** Ensure mobile offset is `8.5rem` and desktop is `7rem`.
