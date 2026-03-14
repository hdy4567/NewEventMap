import { state, saveToDB } from './state.js';
import { initMap } from './map.js';
import { setupSelectionLogic } from './selector.js';
import { initSocket, requestKnowledgeFill } from './ai.js';
import { 
    showToast, renderSubTabs, renderLockerSlots, 
    showDetailSheet, addNewTagPrompt, removeTag,
    setupLockerHandlers
} from './ui.js';
import { initWorker } from './worker_bridge.js';
import { initGoogleAuth, handleAuthClick } from './auth.js';
import { setupEventListeners, resetAllInteractions } from './handlers.js';
import { switchCountry, setSubFilter, filterByTag } from './navigation.js';

/**
 * 🚀 App Orchestrator (Bootstrapper v2.0)
 */

export async function startApp() {
  console.log("🎬 Booting Intelligent Map Engine...");
  
  try {
    // 0. Global API Exposure (Sync first!)
    exposeGlobals();

    // 1. Initialize Core Services
    initMap();
    initWorker();
    initSocket();
    initGoogleAuth();
    
    // 2. Setup Logic & Handlers
    setupSelectionLogic();
    setupEventListeners();
    
    // 3. Initial Rendering
    renderSubTabs();
    renderLockerSlots();
    setupLockerHandlers();

    showToast("시스템 복구 및 모듈화 완료", "success");
  } catch (err) {
    console.error("Critical Failure in startApp:", err);
    throw err; // Re-throw to main.js handler
  }
}

function exposeGlobals() {
  window.state = state;
  window.showToast = showToast;
  window.saveToDB = saveToDB;
  window.switchCountry = switchCountry;
  window.setSubFilter = setSubFilter;
  window.filterByTag = filterByTag;
  window.resetAllInteractions = resetAllInteractions;
  window.showDetailSheet = showDetailSheet;
  window.addNewTagPrompt = addNewTagPrompt;
  window.removeTag = removeTag;
  window.handleAuthClick = handleAuthClick;
  window.requestKnowledgeFill = requestKnowledgeFill;
}
