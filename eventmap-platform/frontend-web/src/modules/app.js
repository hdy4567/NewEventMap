import { state, saveToDB, eventStore, loadStore } from './state.js';
import { initMap } from './map.js';
import { setupSelectionLogic } from './selector.js';
import { initSocket, requestKnowledgeFill } from './ai.js';
import { 
    showToast, renderSubTabs, renderLockerSlots, 
    showDetailSheet, addNewTagPrompt, removeTag,
    setupLockerHandlers, toggleAiChat, setupFilterHandlers,
    updateMonitorVitals, resizeGridItem
} from './ui.js';
import { initWorker } from './worker_bridge.js';
import { initGoogleAuth, handleAuthClick, createArchiveFolderAuto } from './auth.js';
import { setupEventListeners, resetAllInteractions } from './handlers.js';
import { switchCountry, setSubFilter, filterByTag } from './navigation.js';

export async function startApp() {
  console.log("🎬 Booting Intelligent Map Engine...");
  

  try {
    // [SMART FACTORY] Load DB first
    await loadStore();

    // 0. Global API Exposure (Sync first!)
    exposeGlobals();

    // 0.5 [EMERGENCY PRUNE] 기하급수적으로 불어난 데이터 강제 다이어트 (v11.5)
    if (eventStore.length > 5000) {
        console.warn(`[EMERGENCY] Oversized DB (${eventStore.length}). Pruning based on regional capacity...`);
        import('./ai.js').then(m => m.pruneData(1000));
    }

    // 1. Initialize Core Services
    initMap();
    initWorker();
    initSocket();
    await initGoogleAuth();

    // 1.2 AI 셀프 힐링 가동 (과거 데이터 자동 라벨링)
    import('./ai.js').then(m => m.autoHealingAudit());

    // 1.5 Cloud Restore (이미 연동된 경우 자동 복구)
    if (state.isLockerSynced && state.lockerFolderId) {
        import('./auth.js').then(m => m.loadEventsFromDrive());
    }
    
    // 2. Setup Logic & Handlers
    setupSelectionLogic();
    setupEventListeners();
    
    // 3. Initial Rendering
    renderSubTabs();
    renderLockerSlots();
    setupLockerHandlers();
    setupFilterHandlers();
    
    // 4. Update UI Badge
    const badge = document.getElementById('total-count-badge');
    if (badge) {
        badge.innerText = eventStore.length;
        updateMonitorVitals();
    }

    // 5. Auto-open AI Chat on Startup
    setTimeout(() => toggleAiChat(true), 1500);

    // 6. Termination Handler (Lifecycle)
    window.addEventListener('beforeunload', () => {
        console.log("🔌 Terminating AI Services before exit...");
        import('./ai.js').then(m => m.terminateAiBridge());
        import('./worker_bridge.js').then(m => m.terminateWorker());
    });

    showToast("시스템 복구 및 모듈화 완료", "success");
  } catch (err) {
    console.error("Critical Failure in startApp:", err);
    throw err; // Re-throw to main.js handler
  }
}

function exposeGlobals() {
  window.Kuzmo = Object.assign(window.Kuzmo || {}, {
    state,
    eventStore,
    showToast,
    saveToDB,
    switchCountry,
    setSubFilter,
    filterByTag,
    resetAllInteractions,
    showDetailSheet,
    addNewTagPrompt,
    removeTag,
    handleAuthClick,
    requestKnowledgeFill,
    stopKnowledgeFill: () => import('./ai.js').then(m => m.stopKnowledgeFill()),
    wipeRegion: (r) => import('./ai.js').then(m => m.wipeRegion(r)),
    pruneData: (l) => import('./ai.js').then(m => m.pruneData(l)),
    auditAllData: () => import('./ai.js').then(m => m.auditAllData()),
    deepSyncAudit: () => import('./auth.js').then(m => m.deepSyncAudit()),
    toggleAiChat,
    createArchiveFolderAuto,
    refreshFolderList: () => import('./ui.js').then(m => m.refreshFolderList()),
    selectLockerFolder: (name, id) => import('./ui.js').then(m => m.selectLockerFolder(name, id)),
    suggestItineraryFromDeck: () => import('./ai.js').then(m => m.suggestItineraryFromDeck()),
    rebootSystem: () => import('./ai.js').then(m => m.rebootSystem()),
    filterMonitor: (t) => import('./ui.js').then(m => m.filterMonitor(t)),
    switchMode: (mode) => import('./ui.js').then(m => m.switchMode(mode)),
    resizeGridItem: (el) => import('./ui.js').then(m => m.resizeGridItem(el)),

    exportToLocalFS: () => import('./selector.js').then(m => m.exportToLocalFS()),

    deleteEvent: async (id) => {
        const { deleteEvent } = await import('./selector.js');
        if (confirm(`항목 '${id}'을 삭제할까요?`)) deleteEvent(id);
    },
    deleteSelectedEvents: () => import('./selector.js').then(m => m.deleteSelectedEvents()),
    clearSelection: () => import('./selector.js').then(m => m.clearSelection()),

    openQuickNote: () => import('./ui.js').then(m => m.openQuickNote())
  });

  // [LEGACY-UNIFICATION] Standardize on window.Kuzmo, keep essential globals only
  window.handleAuthClick = handleAuthClick;
  window.switchCountry = switchCountry;
  window.setSubFilter = setSubFilter;
  window.toggleAiChat = toggleAiChat;
}
