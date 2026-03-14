import { state } from './state.js';
import { 
  finishSelection, clearSelection, 
  deleteSelectedEvents, syncSelectedEvents,
  applyBatchTags
} from './selector.js';
import { filterMarkers, flyToFilteredResults } from './search.js';

/**
 * ⌨️ Global Event Handlers
 */

export function setupEventListeners() {
  // 🏁 App-wide Mouse Interaction Recovery
  window.addEventListener('mouseup', (e) => {
    if (state.isSelecting) finishSelection(e);
    else resetAllInteractions();
  });
  
  window.addEventListener('keydown', (e) => {
    // 1. ESC: 취소
    if (e.key === 'Escape') {
      clearSelection();
      const sheet = document.getElementById('detail-sheet');
      if (sheet) sheet.classList.remove('active');
      resetAllInteractions();
    }
    
    // 2. Delete: 대량 삭제
    if (e.key === 'Delete') {
      deleteSelectedEvents();
    }

    // 3. Enter: 대량 동기화 (Input 포커스 없을 때만)
    if (e.key === 'Enter' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      syncSelectedEvents();
    }
    if (e.key === 'Enter' && document.activeElement.id === 'batch-tag-input') {
      applyBatchTags();
    }
  });

  // Search Input Handler
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.oninput = (e) => {
      state.searchQuery = e.target.value;
      filterMarkers();
    };
    searchInput.onkeydown = (e) => {
      if (e.key === 'Enter') flyToFilteredResults();
    };
  }

  // 🖱 Selection Bar Button Handlers
  const applyTagsBtn = document.getElementById('apply-batch-tags');
  const deleteBtn = document.getElementById('delete-selection');
  const clearBtn = document.getElementById('clear-selection');

  if (applyTagsBtn) applyTagsBtn.onclick = applyBatchTags;
  if (deleteBtn) deleteBtn.onclick = deleteSelectedEvents;
  if (clearBtn) clearBtn.onclick = clearSelection;

  const batchTagInput = document.getElementById('batch-tag-input');
  if (batchTagInput) {
    batchTagInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyBatchTags();
      }
    };
  }
}

export function resetAllInteractions() {
  if (state.map) {
    state.isSelecting = false;
    state.map.dragging.enable();
  }
  const box = document.getElementById('selection-box');
  if (box) box.style.display = 'none';
}
