import { test, expect } from '@playwright/test';

test('verify map and markers', async ({ page }) => {
  // Go to the local dev server
  await page.goto('http://localhost:9005');
  
  // Wait for the app to bootstrap
  console.log('Waiting for app to load...');
  await page.waitForTimeout(3000);
  
  // Take initial screenshot
  await page.screenshot({ path: 'C:/Users/함동윤/.gemini/antigravity/brain/ffd74813-6d0c-4568-8e02-099a2642e2f0/initial_map_state.png' });
  
  // Find the Antenna button (📡) and click it
  // We'll look for text or icon
  const antennaBtn = page.getByText('📡');
  if (await antennaBtn.isVisible()) {
      console.log('Found 📡 button, clicking...');
      await antennaBtn.click();
  } else {
      console.log('📡 button not found by text, searching by ID or class...');
      // Try by title if available or generic locator
      await page.locator('button:has-text("📡")').click();
  }
  
  // Wait for knowledge fill to start and markers to populate
  console.log('Waiting for markers to appear...');
  await page.waitForTimeout(10000);
  
  // Check for progress bar
  const progressBar = page.locator('#knowledge-progress-container');
  const isProgressVisible = await progressBar.isVisible();
  console.log(`Progress bar visible: ${isProgressVisible}`);
  
  // Count markers - using Leaflet's marker class
  const markerCount = await page.locator('.leaflet-marker-icon').count();
  console.log(`Current marker count on map: ${markerCount}`);
  
  // Take final screenshot
  await page.screenshot({ path: 'C:/Users/함동윤/.gemini/antigravity/brain/ffd74813-6d0c-4568-8e02-099a2642e2f0/final_marker_check.png' });
  
  // Also log console messages to see if bridge is connected
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
});
