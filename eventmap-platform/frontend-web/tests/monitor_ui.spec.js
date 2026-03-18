import { test } from '@playwright/test';

test('Verify AI Labeling Monitor UI', async ({ page }) => {
  await page.goto('http://127.0.0.1:9005');
  await page.waitForTimeout(10000);

  // 1. Check if Monitor Panel exists but is hidden initially
  const monitorHidden = await page.locator('#ai-monitor-panel').isHidden();
  console.log('Monitor hidden initially:', monitorHidden);

  // 2. Trigger auto-healing (which will trigger labeling and update monitor)
  console.log('--- Triggering Labeling ---');
  await page.evaluate(() => {
    // Force a labeling result message to simulate AI action
    window.postMessage({
        action: 'AI_LABEL_RESULT',
        results: [
            { id: '1', suggestedRegion: '@Seoul', suggestedCategory: '#맛집' }
        ]
    }, '*');
  });

  await page.waitForTimeout(2000);
  
  // 3. Check if Monitor is now visible
  const monitorVisible = await page.locator('#ai-monitor-panel').isVisible();
  console.log('Monitor visible after labeling:', monitorVisible);

  const logText = await page.locator('#monitor-logs .log-item').first().innerText();
  console.log('First log entry:', logText);

  await page.screenshot({ path: 'C:/Users/함동윤/.gemini/antigravity/brain/9100547c-0cc2-4214-bc2e-a33f87e4bd9a/monitor_test.png' });
});
