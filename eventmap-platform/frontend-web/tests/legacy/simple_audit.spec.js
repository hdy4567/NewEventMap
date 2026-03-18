import { test, expect } from '@playwright/test';

test('simple log audit', async ({ page }) => {
  page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
  
  await page.goto('http://localhost:9005');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(5000);

  console.log('--- Triggering Sync ---');
  await page.evaluate(() => {
    if (window.Kuzmo && window.Kuzmo.requestKnowledgeFill) {
      window.Kuzmo.requestKnowledgeFill();
    }
  });

  await page.waitForTimeout(20000);

  const stats = await page.evaluate(() => {
    return {
      total: window.Kuzmo.mockEvents.length,
      regions: window.Kuzmo.mockEvents.reduce((acc, e) => {
        acc[e.region] = (acc[e.region] || 0) + 1;
        return acc;
      }, {})
    };
  });

  console.log('FINAL_STATS:', JSON.stringify(stats, null, 2));
  expect(stats.total).toBeGreaterThan(0);
});
