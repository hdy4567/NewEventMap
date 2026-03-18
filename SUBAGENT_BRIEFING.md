# SUBAGENT BRIEFING (System Intelligence v15.0)

## 📌 Critical Changes (URGENT)
- **Port Separation (9005 vs 9091)**: 
    - **Frontend (Vite)**: Runs on port **9005** for HMR and Dev tools.
    - **Backend (C#)**: Moved to port **9091** to avoid port-conflict "seizure games".
- **Worker Renamed**: `worker.js` (Ghost file) has been renamed to **`ai_neural_worker.js`**. 
- **Bridge Updated**: `worker_bridge.js` now uses `new URL('./ai_neural_worker.js', import.meta.url)` to ensure Vite bundles it as a module.

## 🛠️ Current Architecture
- **Web Frontend**: Vite Dev Server (Port 9005) -> Serves `src/main.js`.
- **Backend API**: C# Bridges (Port 9091) -> Handles WebSocket (`SYNC_BRAIN`, `AI_CHAT_MESSAGE`) and Static APIs.
- **Chrome Extension**: Now points to `9091` for local sync.
- **Storage**: IndexedDB (Primary) with localStorage fallback/migration.

## 🧱 Optimization & Cleanup
- **Directory**: Junk files (.log, .png, temp specs) in `frontend-web` have been moved to `.logs/` and `tests/`.
- **API Conflict**: Disabled C# server's behavior of killing processes on port 9005 (handled via port shift).
- **Hardcoding**: Google API keys remain in `AppConfig.cs` for now, but injected dynamically by the C# server if used as a static host.

## ⚠️ Internal Risks
- **Cache Persistence**: If "SyntaxError" persists, user MUST "Clear Site Data" in Chrome Application tab.
- **Build Errors**: C# build may fail if binary is locked by a running instance (run `taskkill /F /IM CSharpServer.exe /T` before build).

## 🚀 Tasks Completed
1. Resolved "Ghost worker.js" by renaming and path unification.
2. Eliminated Port 9005 conflict by moving backend to 9091.
3. Cleaned up root directory to reduce token waste during code analysis.
4. Updated Chrome Extension and Frontend WebSocket to point to the new port.
