import { test } from '@playwright/test';

test('Global Label Summary', async ({ page }) => {
  await page.goto('http://127.0.0.1:9005');
  await page.waitForTimeout(10000);

  const summary = await page.evaluate(() => {
    const events = window.Kuzmo ? window.Kuzmo.mockEvents : [];
    const regionStats = {};
    const typeStats = {};
    
    events.forEach(e => {
      regionStats[e.region] = (regionStats[e.region] || 0) + 1;
      e.tags.forEach(t => {
        if (t.startsWith('#')) typeStats[t] = (typeStats[t] || 0) + 1;
      });
    });

    return { total: events.length, regionStats, typeStats };
  });

  console.log('--- AI LABELING SUMMARY (MULTILINGUAL-L12) ---');
  console.log(`Total Events: ${summary.total}`);
  console.log('Regional Counts:', JSON.stringify(summary.regionStats, null, 2));
  console.log('Category Counts:', JSON.stringify(summary.typeStats, null, 2));
  console.log('--------------------------------------------');
});
