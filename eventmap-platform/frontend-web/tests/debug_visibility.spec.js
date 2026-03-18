import { test, expect } from '@playwright/test';

test('debug marker visibility', async ({ page }) => {
  await page.goto('http://localhost:9005');
  await page.waitForTimeout(3000);
  
  // Check global state
  const stateData = await page.evaluate(() => {
    return {
      currentCountry: window.state.currentCountry,
      mockEventsCount: window.mockEvents.length,
      markersMapCount: window.state.markers.size,
      clusterLayerCount: window.state.clusterGroup.getLayers().length
    };
  });
  
  console.log('DEBUG_STATE:', JSON.stringify(stateData, null, 2));
  
  // Click antenna
  await page.getByText('📡').click();
  console.log('Clicked 📡');
  
  // Wait for streaming
  await page.waitForTimeout(10000);
  
  const stateAfter = await page.evaluate(() => {
    return {
      currentCountry: window.state.currentCountry,
      mockEventsCount: window.mockEvents.length,
      markersMapCount: window.state.markers.size,
      clusterLayerCount: window.state.clusterGroup.getLayers().length,
      sampleEventCountries: window.mockEvents.slice(-5).map(e => e.country)
    };
  });
  
  console.log('DEBUG_STATE_AFTER:', JSON.stringify(stateAfter, null, 2));
  
  await page.screenshot({ path: 'C:/Users/함동윤/.gemini/antigravity/brain/ffd74813-6d0c-4568-8e02-099a2642e2f0/debug_markers.png' });
});
