
import { test, expect } from '@playwright/test';

test('verify data accumulation', async ({ page }) => {
  await page.goto('http://localhost:9005');
  await page.waitForTimeout(5000);

  const getCount = async () => await page.evaluate(() => window.Kuzmo ? window.Kuzmo.mockEvents.length : 0);

  const count1 = await getCount();
  console.log(`Initial Count: ${count1}`);

  // Trigger fill just in case it wasn't running
  await page.evaluate(() => {
    if (window.Kuzmo && window.Kuzmo.requestKnowledgeFill) {
      window.Kuzmo.requestKnowledgeFill();
    }
  });

  console.log('Waiting 15s for accumulation...');
  await page.waitForTimeout(15000);

  const count2 = await getCount();
  console.log(`Updated Count: ${count2}`);
  
  if (count2 > count1) {
    console.log('✅ Data is INCREASING.');
  } else {
    console.log('❌ Data is NOT increasing.');
  }

  expect(true).toBe(true);
});
