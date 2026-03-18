import { test, expect } from '@playwright/test';
import fs from 'fs';

test('rigorous marker audit', async ({ page }) => {
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[INTEGRATE]') || text.includes('[WIPE]') || text.includes('[PRUNE]')) {
      console.log('BROWSER_LOG:', text);
    }
  });

  await page.goto('http://localhost:9005');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(3000);

  console.log('--- Triggering Sync ---');
  await page.evaluate(() => {
    if (window.Kuzmo && window.Kuzmo.requestKnowledgeFill) {
      window.Kuzmo.requestKnowledgeFill();
    }
  });

  // Polling for data
  console.log('--- Waiting for markers to appear ---');
  let count = 0;
  for (let i = 0; i < 30; i++) {
    count = await page.evaluate(() => window.Kuzmo ? window.Kuzmo.mockEvents.length : 0);
    if (count > 0) break;
    await page.waitForTimeout(1000);
  }
  console.log('Final Marker Count:', count);

  const stats = await page.evaluate(() => {
    const events = window.Kuzmo.mockEvents;
    const regions = {};
    events.forEach(e => { regions[e.region] = (regions[e.region] || 0) + 1; });
    return { total: events.length, regions };
  });

  console.log('Detailed Stats:', JSON.stringify(stats, null, 2));

  // Screenshot of markers
  await page.screenshot({ path: 'C:/Users/함동윤/.gemini/antigravity/brain/ffd74813-6d0c-4568-8e02-099a2642e2f0/rigorous_markers.png', fullPage: true });

  // Test Pruning to 100
  console.log('--- Testing Prune to 100 ---');
  await page.evaluate(() => {
    if (window.Kuzmo && window.Kuzmo.pruneData) {
      window.Kuzmo.pruneData(100);
    }
  });
  // pruneData triggers reload
  await page.waitForTimeout(10000);
  
  const finalCount = await page.evaluate(() => window.Kuzmo ? window.Kuzmo.mockEvents.length : 0);
  console.log('Count After Prune:', finalCount);

  expect(count).toBeGreaterThan(0);
});
