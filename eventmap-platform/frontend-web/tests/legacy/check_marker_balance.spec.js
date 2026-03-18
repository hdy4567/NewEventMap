import { test, expect } from '@playwright/test';

test('check marker balance and count', async ({ page }) => {
  await page.goto('http://localhost:9005');
  await page.waitForTimeout(5000); // Wait for sync/render

  const audit = await page.evaluate(() => {
    const events = window.Kuzmo ? window.Kuzmo.mockEvents : [];
    const counts = {};
    events.forEach(e => {
        const region = e.region || "Unknown";
        counts[region] = (counts[region] || 0) + 1;
    });
    
    // Also check for specific Jeju tags
    const jejuCount = events.filter(e => 
        e.title.includes('제주') || 
        (e.tags && e.tags.some(t => t.includes('제주'))) ||
        (e.region && e.region.includes('제주'))
    ).length;

    return { total: events.length, counts, jejuCount };
  });

  console.log('MARKER_AUDIT_TOTAL:', audit.total);
  console.log('REGIONAL_COUNTS:', JSON.stringify(audit.counts, null, 2));
  console.log('JEJU_DETECTED_COUNT:', audit.jejuCount);
  
  await page.screenshot({ path: 'C:/Users/함동윤/.gemini/antigravity/brain/ffd74813-6d0c-4568-8e02-099a2642e2f0/marker_balance_check.png' });
});
