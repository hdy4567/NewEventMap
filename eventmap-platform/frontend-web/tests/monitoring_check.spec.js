import { test, expect } from '@playwright/test';

test('Double Check Marker Density and UI Stability', async ({ page }) => {
  // 1. 앱 접속
  await page.goto('http://localhost:9005');
  await page.waitForTimeout(3000); // 부팅 대기

  // 2. 콘솔 로그 캡처 준비
  const logs = [];
  page.on('console', msg => {
    logs.push(msg.text());
    console.log('BROWSER LOG:', msg.text());
  });

  // 3. 사이드바 열기 및 지식 수혈 트리거
  console.log('Checking Sidebar and Triggering Knowledge Fill...');
  const sidebarTrigger = page.locator('.side-hover-trigger');
  await sidebarTrigger.hover();
  await page.waitForTimeout(500);

  // 📡 수혈 버튼 클릭: 타이틀 속성이나 텍스트를 통해 정확히 타겟팅
  const fillButton = page.locator('.side-app-square:has-text("📡")').or(page.locator('[title="지식 실시간 수혈"]'));
  await fillButton.click({ force: true });

  // 4. 데이터 유입 대기 및 검증
  console.log('Waiting for data stacking...');
  await page.waitForTimeout(10000); // 10초간 수집 관찰

  // 5. 마커 개수 체크 (클러스터 텍스트 또는 mockEvents 상태)
  const markerCount = await page.evaluate(() => window.Kuzmo.mockEvents.length);
  console.log(`Current Marker Count in state: ${markerCount}`);

  // 6. 스크린샷 저장
  await page.screenshot({ path: 'ui_verification_result.png', fullPage: true });

  // 7. 결과 검증
  expect(markerCount).toBeGreaterThan(100); // 최소 100개 이상은 바로 쌓여야 함
});
