import { test } from '@playwright/test';

test('Probe Similarity Scores', async ({ page }) => {
  await page.goto('http://127.0.0.1:9005');
  await page.waitForTimeout(10000);

  // Trigger labeling and log similarities from the worker
  await page.evaluate(() => {
    // Modify worker to log similarity for debugging
    const originalOnMessage = window.state.worker.onmessage;
    console.log('--- Probing Similarity Scores ---');
  });

  // Inject known test items and see how AI reacts
  await page.evaluate(() => {
    const testItems = [
      { id: 'test-1', title: '신주쿠 라멘 맛집', tags: [], lat: 35.6938, lng: 139.7034 },
      { id: 'test-2', title: '성산 일출봉 근처 숙소', tags: [], lat: 33.4582, lng: 126.9424 },
      { id: 'test-3', title: '서울역 주변 풍경', tags: [], lat: 37.5547, lng: 126.9707 }
    ];
    window.state.worker.postMessage({
        action: 'AI_BATCH_LABEL',
        events: testItems
    });
  });

  page.on('console', msg => {
      if (msg.text().includes('📍')) console.log('WORKER_REPORT:', msg.text());
  });

  await page.waitForTimeout(15000);
});
