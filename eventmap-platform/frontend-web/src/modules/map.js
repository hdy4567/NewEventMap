import { state, eventStore, saveToDB } from './state.js';
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
      
      // 🚀 [PERF] Initial Batch Rendering
      const initialMarkers = [];
      eventStore.forEach(e => {
          const marker = addMarkerToMap(e, true);
          initialMarkers.push(marker);
      });
      if (initialMarkers.length > 0) state.clusterGroup.addLayers(initialMarkers);

      // 🖱 오른쪽 클릭 메모 생성 핸들러 (지능형 복구 v4.0)
      state.map.on('contextmenu', async (e) => {
          L.DomEvent.preventDefault(e.originalEvent);
          const { createEventObject } = await import('./utils.js');
          
          const rawInput = prompt("📍 [제목 @태그] 형식으로 입력하세요\n(예: 후쿠오카 @라면 맛집)");
          if (!rawInput) return;

          let title = rawInput.trim();
          let summary = "내용 없음";
          let tags = ["@메모", "#직접입력"];

          if (rawInput.includes('@')) {
              const parts = rawInput.split('@');
              title = parts[0].trim() || "이름 없는 장소";
              summary = parts[1].trim() || "내용 없음";
              if (summary !== "내용 없음") tags.push(`@${summary}`);
          }
          
          const eventData = createEventObject({
              title,
              summary,
              tags,
              lat: e.latlng.lat,
              lng: e.latlng.lng,
              region: "메모"
          });

          eventStore.push(eventData);
          saveToDB();
          addMarkerToMap(eventData);

          import('./ai.js').then(a => a.syncPacketToServer(eventData));
          import('./ui.js').then(u => {
              u.showToast(`'${title}' 메모 생성 완료! (AI 학습 중)`, "success");
              u.renderSubTabs();
          });
      });

      console.log("✅ Map Layer & Markers Ready. (RC Menu Active)");
  } catch (err) {
      console.error("Failed to initialize Leaflet Map:", err);
      throw err;
  }
}

export function addMarkerToMap(data, isBatch = false) {
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
  if (!isBatch) {
    state.clusterGroup.addLayer(marker);
  }
  return marker;
}

export function updateMarkerUI(data) {
  const el = document.getElementById(`marker-${data.id}`);
  if (el) {
    el.classList.add('pulse-active');
    setTimeout(() => el.classList.remove('pulse-active'), 1000);
  }
}
