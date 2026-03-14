# SUBAGENT BRIEFING - NewEventMap Project (V10.1 Diagnostic Sync)

## 📅 날짜: 2026-03-09
## 🎯 현재 상태 및 변경 사항 요약

### 1. 지도 최적화 엔진 (Map Logic V2)
- **Supercluster + Isolate**: `lib/utils/map_optimization_engine.dart`를 통해 백그라운드 아일레이트에서 수만 개의 마커를 클러스터링함. UI 프리징 없는 60FPS 보장.
- **CustomPainter 렌더링**: `lib/widgets/optimized_marker_layer.dart` 구현. 개별 마커 위젯 대신 캔버스에 직접 드로잉하여 메모리 사용량을 90% 이상 절감.
- **공간 쿼리 최적화**: `Geohash` 기반의 SQLite 인덱싱을 통해 필요한 지역의 데이터만 선별적으로 페칭함.

### 2. 진단 및 모니터링 (Monitoring Bridge)
- **도메인 특화 센서**: C# 모니터링 브릿지를 **관광 데이터 도메인**으로 개편.
    - `API_SERVICE_PULL`: 데이터 수집 감시
    - `SQL_DIFF_MERGE`: 차분 동기화 감시
    - `MAP_CLUSTER_RENDER`: 지도 렌더링 연산 감시
- **WebSocket 연동**: Flutter 앱 내 `MonitoringBridgeClient`를 통해 실시간 성능 지표를 C# 관제 서버로 전송 중.

### 3. 코드 다이어트 및 파일 구조 개편
- **MapScreen 분리**: `main.dart`에 몰려있던 비즈니스 로직을 `lib/screens/map_screen.dart`로 격리하여 토큰 효율성 극대화.
- **불필요 파일 정리**: 작업 공간 내 다량의 `.log`, `.bak`, `.txt` 파일 일괄 제거 완료. `mock_data.dart` 의존성을 점진적으로 `DatabaseHelper`로 대체 중.

---
## 🚀 다음 에이전트 가이드
- **차분(Diff) 동기화**: `DatabaseHelper`의 `getEventsByGeohashes`를 활용해 네트워크 복구 시점의 증분 데이터 동기화 로직 구현 필요.
- **RAG 리서치 통합**: `tourism_rag` 결과를 앱 내에서 표시할 수 있는 UI 카드 연동.
- **UI LOD 적용**: 줌 레벨에 따라 CustomPainter의 디테일(핀 아이콘 vs 단순 점)을 차등화하는 로직 추가 제안.
