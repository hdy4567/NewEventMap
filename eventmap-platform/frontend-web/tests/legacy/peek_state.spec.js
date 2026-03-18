import { test, expect } from '@playwright/test';

test('peek current map state', async ({ page }) => {
  await page.goto('http://localhost:9005');
  await page.waitForTimeout(10000); // Give it time to load from local storage

  const data = await page.evaluate(() => {
    return {
      total: window.Kuzmo ? window.Kuzmo.mockEvents.length : -1,
      sample: window.Kuzmo ? window.Kuzmo.mockEvents.slice(0, 3) : []
    };
  });

  console.log('CURRENT_STATE:', JSON.stringify(data, null, 2));
  await page.screenshot({ path: 'C:/Users/함동윤/.gemini/antigravity/brain/ffd74813-6d0c-4568-8e02-099a2642e2f0/peek_state.png' });
});
