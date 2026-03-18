import { test } from '@playwright/test';
import fs from 'fs';

test('Export Label Results', async ({ page }) => {
  await page.goto('http://127.0.0.1:9005');
  await page.waitForTimeout(10000); // Wait for initialization

  // Retrieve current data
  const data = await page.evaluate(() => {
    return window.Kuzmo ? window.Kuzmo.mockEvents.map(e => ({
      title: e.title,
      region: e.region,
      tags: e.tags
    })) : [];
  });

  fs.writeFileSync('c:/YOON/CSrepos/NewEventMap/label_results.json', JSON.stringify(data, null, 2));
});
