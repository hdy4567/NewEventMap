import { state, eventStore, saveToDB } from './state.js';
import { updateSelectionBar, showToast } from './ui.js';
import { filterMarkers } from './search.js';
import { eventToMarkdown, syncToLocalFilesystem } from './utils.js';

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

    // 🛡️ [NATIVE-CLIPBOARD-ONLY] (v2025.3.18.8000)
    // We stop the browser from even THINKING about copying text.
    // The C# backend will handle everything at the OS Kernel level.
    ['copy', 'cut'].forEach(eventName => {
        document.addEventListener(eventName, (e) => {
            const selectedCount = state.selectedIds.size;
            if (selectedCount === 0 || window.getSelection().toString()) return;

            const selectedItems = Array.from(state.selectedIds)
                .map(id => eventStore.find(ev => String(ev.id) === String(id)))
                .filter(Boolean);

            if (selectedItems.length > 0) {
                e.preventDefault(); 
                
                // 📡 [EXTENSION-SYNC] Marker for extension MUST be set synchronously
                if (e.clipboardData) {
                    e.clipboardData.setData('text/plain', `[KUZMO_SYNC] ${selectedItems.length} files`);
                }

                // 🛰️ [SERVERLESS-SYNC] Prepare for AI Paste (Zero-Server)
                window.dispatchEvent(new CustomEvent('KuzmoSync', { detail: selectedItems }));
                
                showToast(`${selectedCount}개의 카드가 클립보드에 준비되었습니다. (Ctrl+V)`, "success");
            }
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') clearSelection();
    });
}


export function finishSelection(e) {
  const box = document.getElementById('selection-box');
  if (!state.isSelecting) return;

  state.isSelecting = false;
  if (state.map) state.map.dragging.enable();
  if (box) box.style.display = 'none';

  // 🛡️ [GUARD] Only recalculate bounds if using map-based start point (Locker selection handled in ui_locker.js)
  if (state.selectionStart && state.map) {
    try {
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
        import('./selection_list.js').then(m => m.selectionList.update());
    } catch (err) {
        console.warn("[SELECTOR] Map LatLng conversion skipped or failed:", err);
    } finally {
        state.selectionStart = null; 
    }
  }
}

export function clearSelection() {
  state.selectedIds.forEach(id => {
    // 1. Map markers visual clear
    const el = document.getElementById(`marker-${id}`);
    if (el) el.classList.remove('selected');
    
    // 2. MEMOREAL cards visual clear
    const cardEl = document.querySelector(`.locker-card[data-id="${id}"]`);
    if (cardEl) cardEl.classList.remove('selected');
  });
  state.selectedIds.clear();
  updateSelectionBar();
  import('./selection_list.js').then(m => m.selectionList.update());
}

/**
 * 🗑 선택된 메모 대량 삭제
 */
export function deleteSelectedEvents() {
  if (state.selectedIds.size === 0) return;
  
  if (!confirm(`${state.selectedIds.size}개의 메모를 삭제하시겠습니까?`)) return;

  // 1. eventStore에서 제거
  const remaining = eventStore.filter(e => !state.selectedIds.has(e.id));
  eventStore.length = 0;
  eventStore.push(...remaining);
  
  // 2. 맵 마커 현행화 및 보관함 카드 제거
  state.selectedIds.forEach(id => {
    state.existingIds.delete(String(id));
    // 지도 마커 지우기
    const item = state.markers.get(id);
    if (item) {
      state.clusterGroup.removeLayer(item.marker);
      state.markers.delete(id);
    }
    // 🗃️ MEMOREAL 카드 DOM에서 즉시 제거
    const cardEl = document.querySelector(`.locker-card[data-id="${id}"]`);
    if (cardEl) cardEl.remove();
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
export function syncSelectedEvents(targetIds = null) {
  const idsToSync = targetIds || Array.from(state.selectedIds);
  if (idsToSync.length === 0) return;

  import('./ai.js').then(ai => {
    let count = 0;
    idsToSync.forEach(id => {
      const item = state.markers.get(id);
      if (item) {
        ai.syncPacketToServer(item.data);
        count++;
      }
    });
    showToast(`${count}개의 메모 서버 동기화 완료`, "success");
    if (!targetIds) clearSelection();
  });
}

/**
 * 📂 [LOCAL-BRIDGE] 선택된 메모를 실제 로컬 파일로 동기화 (C# 연동)
 */
export async function exportToLocalFS() {
    const selectedCount = state.selectedIds.size;
    if (selectedCount === 0) return;

    const selectedItems = Array.from(state.selectedIds)
        .map(id => eventStore.find(ev => String(ev.id) === String(id)))
        .filter(Boolean);

    const { syncToLocalFilesystem } = await import('./utils.js');
    const result = await syncToLocalFilesystem(selectedItems);

    if (result) {
        showToast(`${selectedCount}개의 항목이 로컬 탐색기(Kuzmo_Exports)에 저장되었습니다.`, "success");
        clearSelection();
    } else {
        showToast("로컬 동기화 실패 (C# 서버 확인 필요)", "error");
    }
}

/**
 * 🏷️ [SERVICE] 일괄 데이터 업데이트 (태그 추가, AI 동기화 등)
 * 통합 v7.1: UI와 상관없이 데이터 정합성을 보장하는 단일 통로입니다.
 */
export async function batchUpdateEvents(ids, newTag = null) {
  if (!ids || ids.length === 0) return 0;

  const formatted = newTag ? (newTag.startsWith('@') || newTag.startsWith('#') ? newTag : `@${newTag}`) : null;
  let count = 0;
  
  const ai = await import('./ai.js');
  const { renderSubTabs } = await import('./ui.js');

  ids.forEach(id => {
    const event = eventStore.find(e => String(e.id) === String(id));
    if (event) {
      // 1. 태그 적용
      if (formatted && !event.tags.includes(formatted)) {
        event.tags.push(formatted);
      }
      // 2. 서버 동기화
      ai.syncPacketToServer(event);
      count++;
    }
  });

  if (count > 0) {
    saveToDB();
    renderSubTabs();
  }
  return { count, formatted };
}

/**
 * 🏷 선택된 메모에 일괄 태그 적용 (Map 바인딩용)
 */
export async function applyBatchTags() {
  const input = document.getElementById('batch-tag-input');
  if (state.selectedIds.size === 0) return;

  const { count, formatted } = await batchUpdateEvents(Array.from(state.selectedIds), input?.value.trim());

  const msg = formatted 
    ? `${count}개 동기화 및 '${formatted}' 태그 적용 완료`
    : `${count}개 메모 AI 서버 동기화 완료`;
    
  showToast(msg, "success");
  if (input) input.value = "";
  clearSelection(); 
}

/**
 * 🗑 단일 항목 삭제 (AI 모니터 등에서 호출)
 */
export function deleteEvent(id) {
    // 1. eventStore에서 제거
    const idx = eventStore.findIndex(e => String(e.id) === String(id));
    if (idx !== -1) {
        state.existingIds.delete(String(id));
        eventStore.splice(idx, 1);
        saveToDB();
    }
    
    // 2. 맵 마커 제거
    const item = state.markers.get(id);
    if (item) {
        state.clusterGroup.removeLayer(item.marker);
        state.markers.delete(id);
    }
    
    // 3. UI 갱신 (전체 마커 개수 배지 등)
    const badge = document.getElementById('total-count-badge');
    if (badge) badge.innerText = eventStore.length;

    // 4. 지도 필터 및 전체 재생성 유도 (v23.0)
    filterMarkers();
    
    // 5. 보관함 모드인 경우 렌더링 갱신
    if (document.body.classList.contains('view-locker')) {
        import('./ui.js').then(m => m.renderLockerSlots());
    }
}
