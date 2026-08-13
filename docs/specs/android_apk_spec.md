# Specification: Android APK Config

## Overview

This feature enables the Expeditoo web platform to be built and distributed as an Android APK using Capacitor.

## Configuration Details

- **App Name**: Expeditoo
- **App ID**: `com.expeditoo.app`
- **Framework**: Capacitor 7 (latest)
- **Web Dir**: `out` (even if using server-url, we need a valid folder)
- **Bundled**: No (Server-based navigation) / Yes (Hybrid - Future)

## Behavior

1.  **App Launch**:
    - The app opens a native WebView.
    - It navigates to the configured `server.url` (Production) or loads local content (Development).
    - Splash screen is displayed.

2.  **Native Features**:
    - Push Notifications (Future)
    - Geolocation (Native permission prompt)
    - Camera (Native permission prompt)

## Edge Cases

- **Offline**: Show a specialized offline page (requires caching strategy/PWA).
- **Network Error**: Capacitor handles generic web view errors.

## Implementation Requirements

1.  Add Capacitor dependencies.
2.  Generate `android` folder.
3.  Add `cap` scripts to `package.json`.
