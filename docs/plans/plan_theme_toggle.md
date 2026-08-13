# Plan: Theme Toggle (Light/Dark Mode)

## Overview

Implementasi toggle tema light/dark mode dengan cookie persistence. Saat ini tema hanya mengikuti system preference (`enableSystem`), perlu ditambahkan kontrol manual dengan toggle button dan menyimpan preferensi user di cookie.

## Current State

- ✅ `next-themes` sudah terinstall
- ✅ ThemeProvider sudah dikonfigurasi dengan `enableSystem`
- ✅ Default theme: `light`
- ❌ Tidak ada UI toggle untuk switch tema
- ❌ Tidak ada cookie persistence eksplisit

## Goals

1. Membuat theme toggle component (button/switch)
2. Menyimpan preferensi tema di cookie
3. Menambahkan toggle ke header/navbar
4. Memastikan tema persisten setelah refresh
5. Smooth transition saat switch tema

## Implementation Steps

### 1. Update ThemeProvider Configuration

**File:** `src/components/providers/Providers.tsx`

- Tambahkan `storageKey` untuk cookie name
- Pastikan `enableSystem` tetap true untuk fallback
- Set `disableTransitionOnChange={false}` untuk smooth transition

### 2. Create Theme Toggle Component

**File:** `src/components/ui/theme-toggle.tsx`

- Buat component dengan icon sun/moon
- Gunakan `useTheme()` hook dari next-themes
- Support 3 mode: light, dark, system
- Gunakan dropdown/popover untuk pilihan
- Tambahkan keyboard accessibility

### 3. Create Theme Toggle Hook

**File:** `src/features/app/common/hooks/useThemeToggle.ts`

- Wrapper untuk `useTheme()` dari next-themes
- Handle logic untuk cycle theme (light → dark → system)
- Return current theme, setTheme, dan helper functions

### 4. Integrate to Header/Navbar

**Files to modify:**

- `src/features/app/common/ui/Header.tsx` (authenticated header)
- `src/features/marketing/ui/MarketingHeader.tsx` (marketing header)

Add theme toggle button di sebelah notification bell atau profile menu.

### 5. Add CSS for Smooth Transition

**File:** `src/app/globals.css`

- Tambahkan transition untuk color changes
- Prevent flash of unstyled content (FOUC)

## Files to Create

- `src/components/ui/theme-toggle.tsx` - Theme toggle component
- `src/features/app/common/hooks/useThemeToggle.ts` - Theme toggle hook

## Files to Modify

- `src/components/providers/Providers.tsx` - Update ThemeProvider config
- `src/features/app/common/ui/Header.tsx` - Add toggle to authenticated header
- `src/features/marketing/ui/MarketingHeader.tsx` - Add toggle to marketing header
- `src/app/globals.css` - Add transition styles

## Dependencies

- ✅ `next-themes` (already installed)
- ✅ `lucide-react` (already installed for icons)
- ✅ `@radix-ui/react-dropdown-menu` (already installed via shadcn)

## Testing Checklist

- [ ] Toggle berfungsi di marketing page
- [ ] Toggle berfungsi di authenticated pages
- [ ] Tema tersimpan di cookie
- [ ] Tema persisten setelah refresh
- [ ] Smooth transition tanpa flicker
- [ ] System preference tetap bisa digunakan
- [ ] Responsive di mobile
- [ ] Keyboard accessible

## Notes

- Cookie akan otomatis di-handle oleh `next-themes` dengan `storageKey`
- `next-themes` menggunakan localStorage by default, tapi juga support cookie
- Perlu pastikan tidak ada FOUC (Flash of Unstyled Content)
- Icon: Sun untuk light mode, Moon untuk dark mode, Monitor untuk system
