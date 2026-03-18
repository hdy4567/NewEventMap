import { test, expect } from '@playwright/test';

test('direct sync and check', async ({ page }) => {
  await page.goto('http://localhost:9005');
  await page.waitForTimeout(3000);

  console.log('--- Triggering Sync via Console ---');
  await page.evaluate(() => {
    if (window.Kuzmo && window.Kuzmo.requestKnowledgeFill) {
      window.Kuzmo.requestKnowledgeFill();
    }
  });
  
  console.log('--- Waiting for data (20s) ---');
  await page.waitForTimeout(20000);
  
  const results = await page.evaluate(() => {
    const events = window.Kuzmo ? window.Kuzmo.mockEvents : [];
    const strange = events.filter(e => Math.abs(e.lat) < 1 || isNaN(e.lat));
    const out = events.filter(e => e.lat < 10 || e.lat > 55);
    return { 
      total: events.length, 
      strange: strange.map(e => ({ title: e.title, lat: e.lat })), 
      out: out.map(e => ({ title: e.title, lat: e.lat })) 
    };
  });
  
  console.log('RESULT_TOTAL:', results.total);
  console.log('RESULT_STRANGE:', JSON.stringify(results.strange));
  console.log('RESULT_OUT:', JSON.stringify(results.out));

  await page.screenshot({ path: 'C:/Users/함동윤/.gemini/antigravity/brain/ffd74813-6d0c-4568-8e02-099a2642e2f0/final_sync_check.png' });
});
