# Expeditoo QA Testing

This folder contains all end-to-end (E2E) testing infrastructure for Expeditoo.

## 📋 Documentation

| Document                                         | Description                                         |
| ------------------------------------------------ | --------------------------------------------------- |
| [PAGES_AND_FEATURES.md](./PAGES_AND_FEATURES.md) | Complete map of all 52 pages and ~150 UI components |
| [TEST_PLAN.md](./TEST_PLAN.md)                   | Comprehensive test plan with ~154 test cases        |
| [TEST_STORIES.md](./TEST_STORIES.md)             | Story-based test scenarios with user personas       |

---

## 🎭 Test Accounts (4 Personas)

| #   | Account     | Role           | Persona       | Purpose                          |
| --- | ----------- | -------------- | ------------- | -------------------------------- |
| 1   | **Alice**   | Regular User   | Seller        | Create listings, manage auctions |
| 2   | **Bob**     | Regular User   | Buyer         | Browse, bid, checkout            |
| 3   | **Charlie** | Driver         | Transporter   | Accept & deliver shipments       |
| 4   | **Diana**   | Admin + Driver | Administrator | Platform management              |

### Credentials (TO BE CONFIGURED)

```
ALICE:   [email] / [password]
BOB:     [email] / [password]
CHARLIE: [email] / [password]
DIANA:   [email] / [password]
```

---

## 📁 Structure

```
testing/
├── .auth/                # Stored authentication states
│   ├── alice.json
│   ├── bob.json
│   ├── charlie.json
│   └── diana.json
├── scripts/              # Test spec files
│   ├── smoke.spec.ts     # Current smoke tests
│   └── [future suites]
├── lib/                  # Shared utilities
│   ├── report-helper.ts
│   └── expedito-reporter.ts
├── reports/              # Test reports
│   └── html/             # Playwright HTML reports
├── results/              # Test artifacts
│   ├── test-results/     # Screenshots/videos on failure
│   └── RUN_[timestamp]/  # Run summaries
├── global-setup.ts       # Login all accounts before tests
├── PAGES_AND_FEATURES.md # All pages documentation
├── TEST_PLAN.md          # Test cases documentation
├── TEST_STORIES.md       # Story-based scenarios
└── README.md             # This file
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Playwright browsers installed (`npx playwright install`)
- Dev server running (`pnpm dev`)

### Run All Tests

```bash
npx playwright test
```

### Run Smoke Tests Only

```bash
npx playwright test testing/scripts/smoke.spec.ts
```

### Run with Visible Browser (Headed Mode) 🎬

```bash
npx playwright test --headed
```

### Run with Slow Motion (for demo/debugging)

```bash
npx playwright test --headed --slowmo=500
```

### Interactive UI Mode

```bash
npx playwright test --ui
```

### Run Specific Browser

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Run Mobile Tests

```bash
npx playwright test --project="Mobile Chrome"
npx playwright test --project="Mobile Safari"
```

### View Test Report

```bash
npx playwright show-report testing/reports/html
```

---

## 📊 Test Coverage

| Metric           | Value                  |
| ---------------- | ---------------------- |
| Total Pages      | 52                     |
| Test Cases       | ~154                   |
| Page Coverage    | 100%                   |
| Feature Coverage | ~95%                   |
| Est. Run Time    | ~25-30 min (4 workers) |

---

## 🏗️ Test Suites (Planned)

| Suite             | Tests | Description                      |
| ----------------- | ----- | -------------------------------- |
| 01-public         | 11    | Landing, FAQ, Terms, Privacy     |
| 02-auth           | 13    | Sign In, Sign Up, Password Reset |
| 03-seller         | -     | Alice's seller flows             |
| 04-buyer          | -     | Bob's buyer flows                |
| 05-driver         | 15    | Charlie's driver portal          |
| 06-admin          | 21    | Diana's admin panel              |
| 07-flows          | 10    | End-to-end stories               |
| 08-access-control | 12    | RBAC verification                |

---

## 🐛 Bug Reports

When tests fail, bug reports are automatically generated with:

- Screenshot of the failure
- Markdown description with severity, URL, and error
- Organized in `testing/results/RUN_[timestamp]/`

---

## ⚙️ Configuration

Playwright configuration is in `playwright.config.ts` at the project root.

Key settings:

- **Base URL:** http://localhost:3000
- **Workers:** 4 (parallel execution)
- **Global Setup:** Login all 4 accounts once
- **Auth State Reuse:** Via storageState files
- **Browsers:** Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- **Screenshots:** Only on failure
- **Video:** Retained on failure

---

## 🔜 Next Steps

1. [ ] Configure 4 test account credentials
2. [ ] Implement all test suites
3. [ ] Add CI/CD integration
4. [ ] Add visual regression tests
