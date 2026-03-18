
import { test, expect } from '@playwright/test';

test('debug log capture', async ({ page }) => {
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  
  await page.goto('http://localhost:9005');
  await page.waitForTimeout(5000);

  console.log('--- Triggering Fill ---');
  await page.evaluate(() => {
    if (window.Kuzmo) window.Kuzmo.requestKnowledgeFill();
  });

  console.log('Waiting 30s for logs...');
  await page.waitForTimeout(30000);
});
