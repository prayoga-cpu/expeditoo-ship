---
description: Run Playwright MCP smoke tests on Expeditoo critical paths
---

# Playwright Smoke Test Workflow

This workflow uses Playwright to run automated smoke tests on Expeditoo.

## Prerequisites

Ensure the dev server is running:
// turbo

```bash
pnpm dev
```

## Run All Smoke Tests

// turbo

```bash
npx playwright test testing/scripts/smoke.spec.ts --project=chromium
```

## Run Specific Test

```bash
# Homepage only
npx playwright test testing/scripts/smoke.spec.ts --grep "homepage loads"

# Auth tests only
npx playwright test testing/scripts/smoke.spec.ts --grep "Authentication"

# With visible browser (headed mode)
npx playwright test testing/scripts/smoke.spec.ts --headed
```

## View Test Report

// turbo

```bash
npx playwright show-report testing/reports/html
```

## Test Results Location

- **HTML Reports:** `testing/reports/html/`
- **Screenshots/Videos on Failure:** `testing/results/test-results/`
- **Bug Reports:** `testing/results/bugs/YYYY-MM-DD/HH-mm-ss/`

## Example Prompts for Agent

- "Run smoke tests on homepage and login flow"
- "Test the Messages page and verify chat UI is functional"
- "Verify dashboard filters work correctly"

## Mobile Testing

```bash
npx playwright test testing/scripts/smoke.spec.ts --project="Mobile Chrome"
npx playwright test testing/scripts/smoke.spec.ts --project="Mobile Safari"
```
