import { chromium, FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Define test accounts
const ACCOUNTS = [
  { 
    name: 'alice', 
    email: 'expeditoo.alice@yopmail.com', 
    password: 'Test1234!',
    role: 'Seller (Regular)'
  },
  { 
    name: 'bob', 
    email: 'expeditoo.bob@yopmail.com', 
    password: 'Test1234!',
    role: 'Buyer (Regular)'
  },
  { 
    name: 'charlie', 
    email: 'expeditoo.charlie@yopmail.com', 
    password: 'Test1234!',
    role: 'Driver'
  },
  { 
    name: 'diana', 
    email: 'prayogadevelopment@gmail.com', 
    password: 'admin123',
    role: 'Admin'
  },
];

// Use absolute path based on project root
const AUTH_DIR = path.join(process.cwd(), 'testing', '.auth');

async function globalSetup(config: FullConfig) {
  console.log('\n🔐 Starting Global Auth Setup for 4 Accounts...');

  // Ensure auth directory exists
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  const browser = await chromium.launch();
  
  // Use sequential loop to avoid overloading dev server
  for (const account of ACCOUNTS) {
    const page = await browser.newPage();
    const storageStatePath = path.join(AUTH_DIR, `${account.name}.json`);

    try {
      console.log(`👤 Logging in as ${account.name} (${account.role})...`);
      
      // Navigate to sign in
      await page.goto('http://localhost:3000/signin');
      
      // Wait for content (sometimes dev server is slow)
      await page.waitForLoadState('networkidle');
      
      // Check if already logged in (unlikely in new context but good hygiene)
      if (page.url().includes('/home')) {
         console.log(`   ℹ️ ${account.name} already logged in.`);
      } else {
        // Fill credentials
        await page.fill('input[type="email"]', account.email);
        await page.fill('input[type="password"]', account.password);
        
        // Submit
        const btn = page.locator('button[type="submit"], button:has-text("Sign In")').first();
        await btn.click();
      }
      
      // Wait for successful login (redirect to home)
      // INCREASED TIMEOUT to 60s because dev server is slow
      await page.waitForURL('**/home', { timeout: 60000 });
      
      // Save state
      await page.context().storageState({ path: storageStatePath });
      console.log(`✅ ${account.name} SAVED to ${account.name}.json`);
      
    } catch (error) {
      console.error(`❌ FAILED ${account.name}:`, (error as Error).message);
      
      // Capture failure screenshot
      const screenshotPath = path.join(process.cwd(), 'testing', 'results', `auth-fail-${account.name}.png`);
      await page.screenshot({ path: screenshotPath });
      console.log(`   📸 Screenshot saved: ${screenshotPath}`);
      
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log('🎉 Global Auth Setup Complete!\n');
}

export default globalSetup;
