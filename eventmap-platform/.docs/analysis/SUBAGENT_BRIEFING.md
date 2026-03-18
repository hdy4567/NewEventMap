# SUBAGENT BRIEFING - NewEventMap Project (Web V6.0 Live Sync)

## 📅 날짜: 2026-03-15
## 🎯 현재 상태 및 변경 사항 요약

### 1. 구글 드라이브 보관함 통합 (Locker Integration)
- **실시간 동기화**: `localStorage`의 `mockEvents`가 변경될 때마다 구글 드라이브의 `kuzmo_metadata.json`으로 자동 백업됨.
- **다이내믹 보관함**: 더미 9슬롯 그리드를 폐기하고, 드라이브 폴더 내 실제 파일(이미지, 문서 등)을 페칭하여 렌더링함.
- **커스텀 폴더 선택기**: GAPI Picker API 및 자체 폴더 리스트 연동 완료. `Kuzmo_Archive` 폴더 자동 생성 기능 포함.

### 2. 데이터 다이어트 및 리팩토링 (Purge & Refactor)
- **더미 데이터 제거**: `src/mock_data.js` 및 `src/generate_data.js`를 `tools/` 디렉토리로 격리(제거 대상).
- **모듈화**: `auth.js` (인증/드라이브), `ai.js` (소켓/추론), `ui.js` (렌더링)로 명확히 분리.
- **상태 관리**: `state.js`를 중심으로 UI와 로직이 동기화되며, 전역 `window` 객체 노출을 최소화 중.

### 3. AI & Sync Bridge
- **WebSocket 연동**: C# 서버(`MonitoringBridge`)와 9091 포트로 연동하여 실시간 지식 수혈 및 채팅 기능 제공.
- **온디바이스 추론**: `worker.js` (Transformers.js)를 통해 클라이언트 측에서 의미론적 태그 매칭 및 질의 응답 수행.

---

## 🚀 다음 에이전트 가이드 (주의사항)
- **데이터 중복 주의**: `integrateServerKnowledge`에서 서버 데이터와 로컬 데이터 병합 시 ID 중복 체크 필수.
- **토큰 효율 원칙**: 로그 출력 시 방대한 데이터 JSON 전체를 찍지 말 것 (보관함 리스트 등).
- **CSS 레거시**: `#google-drive-overlay` 등 더 이상 사용하지 않는 UI 요소의 스타일 제거 작업 진행 중.
- **Path 주의**: 작업 경로는 항상 `eventmap-platform/frontend-web`을 기준으로 할 것.
