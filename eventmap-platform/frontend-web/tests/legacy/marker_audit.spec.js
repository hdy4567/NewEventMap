import { test, expect } from '@playwright/test';

test('deep audit map markers', async ({ page }) => {
  await page.goto('http://localhost:9005');
  await page.waitForTimeout(5000);
  
  // 1. Check current markers
  const initialData = await page.evaluate(() => {
    return {
      events: window.mockEvents.length,
      markers: window.state.markers.size,
      visibleLayers: window.state.clusterGroup.getLayers().length,
      country: window.state.currentCountry
    };
  });
  console.log('AUDIT_INITIAL:', JSON.stringify(initialData, null, 2));

  // 2. Click Antenna
  await page.getByText('📡').click();
  console.log('Clicked 📡 - Waiting 20 seconds for full ingestion...');
  
  // 3. Wait longer for API streaming (Wikipedia + OSM can take time)
  await page.waitForTimeout(20000);

  // 4. Final Audit
  const finalData = await page.evaluate(() => {
    // Force a re-filter just in case
    // window.filterMarkers(); // This might not be exposed, let's check
    return {
      events: window.mockEvents.length,
      markers: window.state.markers.size,
      visibleLayers: window.state.clusterGroup.getLayers().length,
      first5Titles: window.mockEvents.slice(0, 5).map(e => e.title),
      last5Titles: window.mockEvents.slice(-5).map(e => e.title)
    };
  });
  
  console.log('AUDIT_FINAL:', JSON.stringify(finalData, null, 2));
  
  // 5. Check if markers are overlapping (all at same coord)
  const overlappingCheck = await page.evaluate(() => {
      const coords = window.mockEvents.map(e => `${e.lat},${e.lng}`);
      const uniqueCoords = new Set(coords);
      return {
          total: coords.length,
          unique: uniqueCoords.size
      };
  });
  console.log('OVERLAP_CHECK:', JSON.stringify(overlappingCheck, null, 2));

  await page.screenshot({ path: 'C:/Users/함동윤/.gemini/antigravity/brain/ffd74813-6d0c-4568-8e02-099a2642e2f0/marker_audit_final.png' });
});
