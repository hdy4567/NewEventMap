// 🚀 Global Error Shield (First!)
window.onerror = function(msg, url, line, col, error) {
  const errMsg = `[CRITICAL ERROR]\nMsg: ${msg}\nLine: ${line}\nCol: ${col}\nURL: ${url}\nStack: ${error ? error.stack : 'N/A'}`;
  console.error(errMsg);
  alert(errMsg);
  return false;
};

console.log("🎬 Bootstrapping Process Started...");

import { startApp } from './modules/app.js';

console.log("🚀 Calling startApp()...");
startApp().then(() => {
    console.log("✅ App successfully initialized.");
}).catch(err => {
    console.error("❌ Critical Failure during startApp:", err);
    alert("앱 초기화 중 심각한 오류가 발생했습니다: " + err.message);
});
