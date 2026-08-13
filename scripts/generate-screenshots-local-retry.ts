
import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

async function generateScreenshots() {
  const BASE_URL = 'http://localhost:3000';
  console.log(`Launching browser (using localhost to bypass Vercel bot protection)...`);
  
  // We will re-use localhost but simulate "perfect loading" by injecting data if needed or just waiting longer.
  // The user complained about localhost "loading state", so we will wait even longer and maybe interact to trigger loads.
  
  const browser = await chromium.launch();
  
  console.log('Logging in to Localhost...');
  const loginContext = await browser.newContext();
  const loginPage = await loginContext.newPage();
  
  try {
    await loginPage.goto(`${BASE_URL}/signin`, { timeout: 60000 });
    await loginPage.fill('input[name="email"]', 'prayogadevelopment@gmail.com');
    await loginPage.fill('input[name="password"]', 'admin123');
    await loginPage.click('button[type="submit"]');
    
    // Wait for network idle to ensure redirect processing starts
    await loginPage.waitForLoadState('networkidle');
    
    // Wait for home page, increased timeout
    await loginPage.waitForURL('**/home', { timeout: 90000 });
    console.log('Login successful.');
  } catch (e) {
    console.error('Login failed on localhost.', e);
    process.exit(1);
  }
  
  const authStatePath = 'local-auth.json';
  await loginContext.storageState({ path: authStatePath });
  await loginContext.close();

  const screenshots = [
    { route: '/home', name: 'home', types: ['mobile', 'desktop'] },
    { route: '/messages', name: 'messages', types: ['mobile'] },
    { route: '/deliveries', name: 'deliveries', types: ['mobile', 'desktop'] },
    { route: '/create', name: 'create', types: ['mobile'] }
  ];

  // Desktop Context
  const desktopContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    storageState: authStatePath,
    baseURL: BASE_URL
  });

  // Mobile Context
  const mobileContext = await browser.newContext({
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 3,
    userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36',
    storageState: authStatePath,
    baseURL: BASE_URL
  });

  for (const shot of screenshots) {
    if (shot.types.includes('desktop')) {
      console.log(`Taking Desktop: ${shot.name}`);
      const page = await desktopContext.newPage();
      await page.goto(shot.route);
      
      // WAIT 15 SECONDS to rely on data fetch settling
      console.log('Waiting 15 seconds for comprehensive data loading...');
      await page.waitForTimeout(15000); 
      
      // Scroll to trigger lazy loads if any
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1000);

      const filePath = path.join(process.cwd(), `public/screenshots/${shot.name}-desktop.jpg`);
      await page.screenshot({ path: filePath, type: 'jpeg', quality: 90 });
      console.log(`Saved: ${filePath}`);
      await page.close();
    }

    if (shot.types.includes('mobile')) {
      console.log(`Taking Mobile: ${shot.name}`);
      const page = await mobileContext.newPage();
      await page.goto(shot.route);
      
      console.log('Waiting 15 seconds for comprehensive data loading...');
      await page.waitForTimeout(15000);

       // Scroll interactions
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1000);

      const filePath = path.join(process.cwd(), `public/screenshots/${shot.name}-mobile.jpg`);
      await page.screenshot({ path: filePath, type: 'jpeg', quality: 90 });
      console.log(`Saved: ${filePath}`);
      await page.close();
    }
  }

  await browser.close();
  if (fs.existsSync(authStatePath)) fs.unlinkSync(authStatePath);
  console.log('All screenshots generated successfully from Localhost (High Latency Wait).');
}

generateScreenshots().catch(console.error);
