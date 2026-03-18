import { test, expect } from '@playwright/test';
test.setTimeout(120000); // 2 minutes for L12 model

test('AI Labeling Verification Test', async ({ page }) => {
  page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
  await page.goto('http://127.0.0.1:9005');
  
  console.log('--- Loading AI Model (L12) ---');
  await page.waitForTimeout(15000);

  console.log('--- Cleaning Environment ---');
  await page.evaluate(() => {
    localStorage.clear();
    if (window.mockEvents) window.mockEvents.length = 0;
  });
  await page.waitForTimeout(2000);

  console.log('--- Triggering Knowledge Fill ---');
  await page.evaluate(() => {
    if (window.Kuzmo && window.Kuzmo.requestKnowledgeFill) {
      window.Kuzmo.requestKnowledgeFill();
    }
  });

  console.log('--- Waiting for AI Labeling (60s) ---');
  await page.waitForTimeout(60000);

  const labelAudit = await page.evaluate(() => {
    const events = window.Kuzmo ? window.Kuzmo.mockEvents : [];
    return events.map(e => ({
      title: e.title,
      region: e.region,
      category: e.tags.find(t => t.startsWith('#')) || 'N/A',
      tags: e.tags.join(', ')
    }));
  });

  console.log('--- AUDIT RESULT START ---');
  labelAudit.slice(-15).forEach(item => {
    console.log(`LABEL_MATCH: [${item.title}] -> REGION: ${item.region} | CAT: ${item.category} | TAGS: ${item.tags}`);
  });
  console.log('--- AUDIT RESULT END ---');
  
  expect(labelAudit.length).toBeGreaterThan(0);
});
