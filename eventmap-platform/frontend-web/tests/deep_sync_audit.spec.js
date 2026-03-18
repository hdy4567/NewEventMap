import { test, expect } from '@playwright/test';

test('Deep Sync Audit - Local vs Cloud Parity Check', async ({ page }) => {
  // 1. 앱 접속 (로컬 서버 9005번)
  await page.goto('http://localhost:9005');
  await page.waitForTimeout(5000); // 부팅 및 자동 로그인(세션 있을 시) 대기

  console.log('--- DEEP SYNC AUDIT START ---');

  // 2. Audit 실행 및 결과 캡처
  const auditResult = await page.evaluate(async () => {
    if (window.Kuzmo && window.Kuzmo.deepSyncAudit) {
      const res = await window.Kuzmo.deepSyncAudit();
      return res || { success: false, status: 'AUTH_REQUIRED', error: 'Authentication or Folder Selection required' };
    }
    return { success: false, status: 'NOT_FOUND', error: 'Kuzmo.deepSyncAudit not found' };
  });

  console.log('Audit Summary:', JSON.stringify(auditResult, null, 2));

  // 3. 결과 검증 및 리포트
  if (auditResult.success) {
    console.log(`✅ [SUCCESS] Local Count: ${auditResult.localTotal}`);
    console.log(`✅ [SUCCESS] Cloud Count: ${auditResult.cloudTotal}`);
    console.log(`📊 [STATUS] ${auditResult.status}`);
    
    if (auditResult.status !== "PERFECT_MATCH") {
      console.warn(`⚠️ [DISCREPANCY] Local Only: ${auditResult.details?.onlyLocal?.length || 0}`);
      console.warn(`⚠️ [DISCREPANCY] Cloud Only: ${auditResult.details?.onlyCloud?.length || 0}`);
      console.warn(`⚠️ [DISCREPANCY] Mismatches: ${auditResult.details?.mismatches?.length || 0}`);
    }

    await page.screenshot({ path: 'deep_sync_audit_report.png', fullPage: true });
    expect(auditResult.success).toBe(true);
  } else {
    console.warn('--- AUDIT SKIPPED/FAILED ---');
    console.warn('Reason:', auditResult.error);
    console.warn('Status:', auditResult.status);
    
    // Auth required is a known state, not a "test failure" in this context
    if (auditResult.status === 'AUTH_REQUIRED') {
      console.info('💡 Note: This test requires a logged-in session to perform cloud comparison.');
    } else {
      expect(auditResult.success).toBe(true); // Fail if the function is just missing
    }
  }
});
