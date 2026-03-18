/**
 * ð Central State & Constants
 */
export const CONFIG = {
  apiKey: ("AIzaSyD6J-r2JgcnBg6zBCpBIpc1AYw6-RQFuTE" || "").trim(),
  clientId: ("899975761873-vbi5p40pc7g8omnfqhk5b4vk1kef0gj0.apps.googleusercontent.com" || "").trim(),
  discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
  scopes: "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file",
  appId: ("899975761873" || "").trim()
};

console.log("ð ï¸ Google Config Verified:", { 
  keyPrefix: CONFIG.apiKey.substring(0, 7) + "...",
  clientIdPrefix: CONFIG.clientId.substring(0, 10) + "...",
  appId: CONFIG.appId,
  origin: window.location.origin
});

export const REGION_COORDS = {
  "ìì¸": [37.5665, 126.9780], "ê²½ê¸°ë": [37.2752, 127.0095], "ê°ìë": [37.8228, 128.1555],
  "ì¶©ë¨": [36.6588, 126.6728], "ì¶©ë¶": [36.6350, 127.4912], "ì ì£¼ë": [33.4996, 126.5312],
  "ëì¿": [35.6762, 139.6503], "ì¤ì¬ì¹´": [34.6937, 135.5023], "íì¿ ì¤ì¹´": [33.5902, 130.4017],
  "ëê³ ì¼": [35.1815, 136.9066], "ëê°í": [37.9162, 139.0364], "íì¹´ì´ë": [43.0642, 141.3469], "ì¤í¤ëì": [26.2124, 127.6809]
};

export const DB_KEY = 'kuzmo_events_db';

export const state = {
  map: null,
  clusterGroup: null,
  markers: new Map(),
  searchQuery: "",
  currentCountry: "Korea",
  currentSubFilter: "ì ì²´",
  isAiActive: false,
  showTourist: true, // ð¡ [FILTER] ê´ê´ë¥ ë§ì»¤ íì ì¬ë¶
  showMemory: true,  // ð [FILTER] ì¶ìµë¥ ë§ì»¤ íì ì¬ë¶
  lastRequestId: 0,
  isLockerSynced: localStorage.getItem('is_locker_synced') === 'true',
  lockerFolderName: localStorage.getItem('locker_folder_name') || '01_Archive',
  lockerFolderId: localStorage.getItem('locker_folder_id') || null,
  socket: null,
  selectedIds: new Set(),
  selectionStart: null,
  isSelecting: false,
  learningBrain: JSON.parse(localStorage.getItem('ai_learning_brain')) || {
    "@ìì¸": { keywords: ["ìì¸", "ê°ë¨", "ì¢ë¡", "seoul"], weight: 1.5 },
    "@ëì¿": { keywords: ["ëì¿", "ìë¶ì¼", "tokyo"], weight: 1.5 },
    "#ë§ì§": { keywords: ["ë§ì§", "ë¨¹ì", "ìë¹", "í¸ë"], weight: 1.0 },
    "#ê¸°ë¡": { keywords: ["ë©ëª¨", "ê¸°ë¡", "ë¸í¸", "memo", "ê¸"], weight: 1.2 }
  },
  conversationHistory: [], // ð§  AI ë¨ê¸° ê¸°ìµ ì ì¥ì (ìµê·¼ 5ê°)
  currentDetailData: null
};

const INITIAL_STUB_DATA = [];

export let mockEvents = JSON.parse(localStorage.getItem(DB_KEY)) || INITIAL_STUB_DATA;

export function saveToDB() {
  try {
    const data = JSON.stringify(mockEvents);
    localStorage.setItem(DB_KEY, data);
    console.log(`ð¡ [DB] Successfully saved ${mockEvents.length} items. (${(data.length / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.error("â [DB SAVE ERROR]", err);
    if (err.name === 'QuotaExceededError' || err.code === 22) {
        console.warn("â ï¸ Quota Exceeded! Pruning oldest 30% of memories...");
        const pruneCount = Math.floor(mockEvents.length * 0.3);
        mockEvents.splice(0, pruneCount);
        saveToDB(); // Retry saving after prune
    }
  }

  // âï¸ [CLOUD DEEP SYNC] ì ì© ë³´ê´í¨ì ìë ë°±ì (v6.0)
  if (state.isLockerSynced && state.lockerFolderId) {
    import('./auth.js').then(m => m.syncEventsToDrive());
  }
}

