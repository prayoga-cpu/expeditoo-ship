import * as fs from 'fs';
import * as path from 'path';
import { Page, TestInfo } from '@playwright/test';

// Configuration for Result Locations
const RESULTS_ROOT = path.join(process.cwd(), 'testing', 'results');

export interface BugReport {
  testName: string;
  description: string;
  severity: 'critical' | 'major' | 'minor';
  screenshotPath?: string;
}

export class TestReporter {
  private runId: string;
  private runFolder: string;
  private reports: BugReport[] = [];

  constructor() {
    // Generate unique Run ID based on timestamp
    const now = new Date();
    this.runId = now.toISOString().replace(/[:.]/g, '-').split('T').join('_');
    
    // Create folder: testing/results/RUN_2025-12-14_08-30-00
    this.runFolder = path.join(RESULTS_ROOT, `RUN_${this.runId}`);
    
    if (!fs.existsSync(this.runFolder)) {
      fs.mkdirSync(this.runFolder, { recursive: true });
    }
  }

  getRunFolder() {
    return this.runFolder;
  }

  async captureBug(
    page: Page, 
    testName: string, 
    description: string, 
    severity: 'critical' | 'major' | 'minor'
  ) {
    const sanitizedTestName = testName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const screenshotName = `${sanitizedTestName}.png`;
    const screenshotPath = path.join(this.runFolder, screenshotName);

    // 1. Capture Screenshot
    try {
        await page.screenshot({ path: screenshotPath, fullPage: true });
    } catch (e) {
        console.error('Failed to capture screenshot', e);
    }

    // 2. Create Individual Bug Report (Markdown)
    const bugMd = `
# 🐞 BUG REPORT: ${testName}

| Metadata | Value |
|----------|-------|
| **Severity** | ${severity.toUpperCase()} |
| **URL** | ${page.url()} |
| **Time** | ${new Date().toISOString()} |

## Description
${description}

## Evidence
![Screenshot](./${screenshotName})

---
*Expeditoo QA Automation*
`;
    
    fs.writeFileSync(path.join(this.runFolder, `${sanitizedTestName}.md`), bugMd);

    // 3. Store for Summary
    this.reports.push({
      testName,
      description,
      severity,
      screenshotPath: screenshotName
    });

    console.log(`[BUG CAPTURED] ${testName} -> ${this.runFolder}`);
  }

  generateSummary(totalTests: number, passed: number, failed: number) {
    const summaryMd = `
# 🧪 TEST EXECUTION SUMMARY
**Run ID:** ${this.runId}
**Date:** ${new Date().toLocaleString()}

## 📊 Statistics
| Metric | Count |
|--------|-------|
| **Total Tests** | ${totalTests} |
| **Passed** | ✅ ${passed} |
| **Failed** | ❌ ${failed} |
| **Bugs Found** | 🐞 ${this.reports.length} |

## 🐛 Defect List
${this.reports.length === 0 ? '*No bugs found! Great job! 🎉*' : ''}

${this.reports.map(bug => `
### [${bug.severity.toUpperCase()}] ${bug.testName}
- **Issue:** ${bug.description}
- **Evidence:** [View Screenshot](./${bug.screenshotPath})
- **Detail:** [View Report](./${bug.testName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md)
`).join('\n')}

---
*Generated automatically by Expeditoo QA Framework*
`;

    fs.writeFileSync(path.join(this.runFolder, 'Run_Summary.md'), summaryMd);
    return path.join(this.runFolder, 'Run_Summary.md');
  }
}

// Export singleton instance if needed, or usage per test file
export const reporter = new TestReporter();
