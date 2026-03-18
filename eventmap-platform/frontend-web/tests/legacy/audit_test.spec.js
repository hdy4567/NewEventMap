import { test, expect } from '@playwright/test';
import fs from 'fs';

test('sync and audit markers to file', async ({ page }) => {
  await page.goto('http://localhost:9005');
  await page.waitForTimeout(3000);

  console.log('--- Triggering Sync ---');
  await page.evaluate(() => {
    if (window.Kuzmo && window.Kuzmo.requestKnowledgeFill) {
      window.Kuzmo.requestKnowledgeFill();
    }
  });

  console.log('--- Waiting for Data (20s) ---');
  await page.waitForTimeout(20000);

  const audit = await page.evaluate(() => {
    const events = window.Kuzmo ? window.Kuzmo.mockEvents : [];
    const counts = {};
    events.forEach(e => {
        const r = e.region || "Unknown";
        counts[r] = (counts[r] || 0) + 1;
    });
    
    const jejuMatches = events.filter(e => 
        e.title.includes('제주') || 
        (e.tags && e.tags.some(t => t.includes('제주'))) ||
        (e.region && e.region.includes('제주'))
    ).map(e => e.title);

    return { total: events.length, counts, jejuCount: jejuMatches.length, jejuSample: jejuMatches.slice(0, 5) };
  });

  const report = `TOTAL_MARKERS: ${audit.total}\nJEJU_MARKERS: ${audit.jejuCount}\nREGIONAL_DETAIL: ${JSON.stringify(audit.counts, null, 2)}\nJEJU_SAMPLES: ${audit.jejuSample.join(', ')}`;
  fs.writeFileSync('C:/Users/함동윤/.gemini/antigravity/brain/ffd74813-6d0c-4568-8e02-099a2642e2f0/audit_report.txt', report);
  
  await page.screenshot({ path: 'C:/Users/함동윤/.gemini/antigravity/brain/ffd74813-6d0c-4568-8e02-099a2642e2f0/audit_screenshot.png' });
});
