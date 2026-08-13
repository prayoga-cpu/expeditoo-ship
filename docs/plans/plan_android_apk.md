# Plan: Android APK Conversion (Capacitor)

## Goal

Convert the existing Next.js 16 web application into an Android APK using Capacitor.

## Strategy

Since the application relies heavily on Server Components, Database connectivity, and Authentication which run on the server, a purely static export (`output: 'export'`) allows the app to load but breaks API routes.
Therefore, the Android App will be configured as a **Hybrid Shell**:

1.  **Development**: Points to local server (`http://10.0.2.2:3000` for Android Emulator).
2.  **Production**: Points to the deployed URL (e.g., `https://expeditoo.com`).

## Steps

1.  **Install Dependencies**
    - `@capacitor/core`
    - `@capacitor/cli`
    - `@capacitor/android`

2.  **Initialize Capacitor**
    - Config file: `capacitor.config.ts`
    - App Name: `Expeditoo`
    - App ID: `com.expeditoo.app`

3.  **Configure Android Platform**
    - Add android platform via CLI.
    - Setup permissions (Internet, etc.) in `AndroidManifest.xml`.

4.  **Build Workflow**
    - Define scripts in `package.json` for building the APK.

## Complexity

- **Level**: 3 (Routine setup, but requires correct configuration for Next.js)

## Files to Create/Modify

- `capacitor.config.ts` (Create)
- `android/` (Directory created by Capacitor)
- `package.json` (Modify scripts)
