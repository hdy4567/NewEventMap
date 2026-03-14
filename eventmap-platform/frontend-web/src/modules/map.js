import { state, mockEvents, saveToDB } from './state.js';
// 🚀 순환 참조 방지: ui.js는 필요할 때 동적 임포트

/**
 * 🗺 Map Service Layer
 */
export function initMap() {
  console.log("📍 Initializing Map...");
  if (typeof L === 'undefined') {
      console.error("Leaflet(L) is missing!");
      throw new Error("Leaflet(L) 라이브러리를 찾을 수 없습니다.");
  }
  
  try {
      state.map = L.map('map', { zoomControl: false, preferCanvas: true }).setView([37.5665, 126.9780], 7);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap'
      }).addTo(state.map);
  
      if (typeof L.markerClusterGroup === 'function') {
          state.clusterGroup = L.markerClusterGroup({
            showCoverageOnHover: false,
            maxClusterRadius: 50,
            disableClusteringAtZoom: 16,
            iconCreateFunction: (c) => L.divIcon({
              html: `<div class="marker-cluster-custom"><span>${c.getChildCount()}</span></div>`,
              className: 'marker-cluster-wrap',
              iconSize: [44, 44]
            })
          });
      } else {
          console.warn("MarkerClusterGroup not found. Falling back to plain FeatureGroup.");
          state.clusterGroup = L.featureGroup();
      }
      state.map.addLayer(state.clusterGroup);
      mockEvents.forEach(e => addMarkerToMap(e));

      // 🖱 오른쪽 클릭 메모 생성 핸들러 (지능형 복구 v4.0)
      state.map.on('contextmenu', async (e) => {
          L.DomEvent.preventDefault(e.originalEvent);
          
          // 0. DB 용량 체크 (안정성 확보)
          const DB_LIMIT = 100; // 사용자 50개 언급 대비 넉넉하게 100개 설정
          if (mockEvents.length >= DB_LIMIT) {
              import('./ui.js').then(u => u.showToast(`DB 용량 초과 (${mockEvents.length}/${DB_LIMIT}). 불필요한 메모를 삭제해 주세요.`, "error"));
              return;
          }

          const rawInput = prompt("📍 [제목 @태그] 형식으로 입력하세요\n(예: 후쿠오카 @라면 맛집)");
          if (!rawInput) return;

          let title = rawInput.trim();
          let summary = "내용 없음";
          let tags = ["@메모", "#직접입력"];

          // 🚀 지능형 파싱: @ 기호가 있다면 쪼개기
          if (rawInput.includes('@')) {
              const parts = rawInput.split('@');
              title = parts[0].trim() || "이름 없는 장소"; // @앞이 비어있을 경우 대비
              summary = parts[1].trim() || "내용 없음";
              // 태그로 자동 삽입 (@로 시작하도록 통일)
              if (summary !== "내용 없음") {
                  tags.push(`@${summary}`);
              }
          }
          
          const eventData = {
              id: `memo-${Date.now()}`,
              title: title,
              summary: summary,
              tags: tags,
              lat: e.latlng.lat,
              lng: e.latlng.lng,
              imageUrl: `https://picsum.photos/seed/${encodeURIComponent(title)}/400/300`,
              region: "메모",
              country: "Memo"
          };

          // 1. 데이터 저장
          mockEvents.push(eventData);
          saveToDB();

          // 2. 맵에 즉시 반영
          addMarkerToMap(eventData);

          // 3. AI 서버 실시간 동기화
          import('./ai.js').then(a => a.syncPacketToServer(eventData));
          import('./ui.js').then(u => {
              u.showToast(`'${title}' 메모 생성 완료! (AI 학습 중)`, "success");
              u.renderSubTabs(); // 태그 목록 갱신을 위해 탭 다시 그리기
          });
      });

      console.log("✅ Map Layer & Markers Ready. (RC Menu Active)");
  } catch (err) {
      console.error("Failed to initialize Leaflet Map:", err);
      throw err;
  }
}

export function addMarkerToMap(data) {
  const marker = L.marker([data.lat, data.lng], {
    icon: L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="marker-wrap" id="marker-${data.id}"><img src="${data.imageUrl}" class="marker-img"></div>`,
      iconSize: [64, 64], iconAnchor: [32, 32]
    })
  });
  marker.on('click', (e) => { 
    L.DomEvent.stopPropagation(e); 
    import('./ui.js').then(ui => ui.showDetailSheet(data));
    state.map.panTo(marker.getLatLng()); 
  });
  state.markers.set(data.id, { marker, data });
  state.clusterGroup.addLayer(marker);
}

export function updateMarkerUI(data) {
  const el = document.getElementById(`marker-${data.id}`);
  if (el) {
    el.classList.add('pulse-active');
    setTimeout(() => el.classList.remove('pulse-active'), 1000);
  }
}
