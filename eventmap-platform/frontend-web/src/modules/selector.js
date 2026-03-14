import { state, mockEvents, saveToDB } from './state.js';
import { updateSelectionBar, showToast } from './ui.js';

/**
 * 🎯 Selection Logic Service
 */
export function setupSelectionLogic() {
  const box = document.getElementById('selection-box');

  state.map.on('mousedown', (e) => {
    if (e.originalEvent.altKey) {
      state.isSelecting = true;
      state.selectionStart = e.containerPoint;
      state.map.dragging.disable();
      box.style.display = 'block';
      box.style.left = e.containerPoint.x + 'px';
      box.style.top = e.containerPoint.y + 'px';
      box.style.width = '0px';
      box.style.height = '0px';
      clearSelection();
      L.DomEvent.preventDefault(e.originalEvent);
    }
  });

  state.map.on('mousemove', (e) => {
    if (!state.isSelecting) return;
    const current = e.containerPoint;
    const x = Math.min(current.x, state.selectionStart.x);
    const y = Math.min(current.y, state.selectionStart.y);
    const w = Math.abs(current.x - state.selectionStart.x);
    const h = Math.abs(current.y - state.selectionStart.y);

    box.style.left = x + 'px';
    box.style.top = y + 'px';
    box.style.width = w + 'px';
    box.style.height = h + 'px';
  });

  state.map.on('mouseup', (e) => {
    if (state.isSelecting) finishSelection(e.originalEvent);
  });
}

export function finishSelection(e) {
  const box = document.getElementById('selection-box');
  if (!state.isSelecting) return;

  state.isSelecting = false;
  if (state.map) state.map.dragging.enable();
  if (box) box.style.display = 'none';

  if (state.selectionStart) {
    const startLatLng = state.map.containerPointToLatLng(state.selectionStart);
    const endLatLng = state.map.mouseEventToLatLng(e);
    const bounds = L.latLngBounds(startLatLng, endLatLng);

    state.markers.forEach(({ marker, data }) => {
      if (state.clusterGroup.hasLayer(marker) && bounds.contains(marker.getLatLng())) {
        state.selectedIds.add(data.id);
        const el = document.getElementById(`marker-${data.id}`);
        if (el) el.classList.add('selected');
      }
    });
    updateSelectionBar();
  }
}

export function clearSelection() {
  state.selectedIds.forEach(id => {
    const el = document.getElementById(`marker-${id}`);
    if (el) el.classList.remove('selected');
  });
  state.selectedIds.clear();
  updateSelectionBar();
}

/**
 * 🗑 선택된 메모 대량 삭제
 */
export function deleteSelectedEvents() {
  if (state.selectedIds.size === 0) return;
  
  if (!confirm(`${state.selectedIds.size}개의 메모를 삭제하시겠습니까?`)) return;

  // 1. mockEvents에서 제거
  const remaining = mockEvents.filter(e => !state.selectedIds.has(e.id));
  mockEvents.length = 0;
  mockEvents.push(...remaining);
  
  // 2. 맵 마커 제거
  state.selectedIds.forEach(id => {
    const item = state.markers.get(id);
    if (item) {
      state.clusterGroup.removeLayer(item.marker);
      state.markers.delete(id);
    }
  });

  // 3. DB 저장 및 UI 초기화
  saveToDB();
  state.selectedIds.clear();
  updateSelectionBar();
  showToast("선택된 메모 삭제 완료", "success");
}

/**
 * 🔁 선택된 메모 서버 동기화 (Enter)
 */
export function syncSelectedEvents() {
  if (state.selectedIds.size === 0) return;

  import('./ai.js').then(ai => {
    let count = 0;
    state.selectedIds.forEach(id => {
      const item = state.markers.get(id);
      if (item) {
        ai.syncPacketToServer(item.data);
        count++;
      }
    });
    showToast(`${count}개의 메모 서버 동기화 완료`, "success");
    clearSelection();
  });
}

/**
 * 🏷 선택된 메모에 일괄 태그 적용 + AI 서버 즉시 동기화 (통합 v5.0)
 */
export function applyBatchTags() {
  const input = document.getElementById('batch-tag-input');
  if (state.selectedIds.size === 0) return;

  const tag = input?.value.trim() || "";
  const formatted = tag ? (tag.startsWith('@') || tag.startsWith('#') ? tag : `@${tag}`) : null;

  let tagCount = 0;
  let syncCount = 0;

  import('./ai.js').then(ai => {
    state.selectedIds.forEach(id => {
      const event = mockEvents.find(e => e.id === id);
      const item = state.markers.get(id);

      if (event) {
        // 1. 태그 적용 (입력값이 있을 때만)
        if (formatted && !event.tags.includes(formatted)) {
          event.tags.push(formatted);
          tagCount++;
        }
        // 2. 실시간 AI 서버 동기화 (무조건 수행)
        ai.syncPacketToServer(event);
        syncCount++;
      }
    });

    if (tagCount > 0) saveToDB();
    
    const msg = formatted 
      ? `${syncCount}개 동기화 및 '${formatted}' 태그 적용 완료`
      : `${syncCount}개 메모 AI 서버 동기화 완료`;
      
    showToast(msg, "success");
    if (input) input.value = "";
    
    import('./ui.js').then(ui => ui.renderSubTabs());
    clearSelection(); // 작업 완료 후 선택 해제
  });
}
