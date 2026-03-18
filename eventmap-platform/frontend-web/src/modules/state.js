import { EventDB } from './db.js';

export const CONFIG = {
  apiKey: (import.meta.env.VITE_GOOGLE_API_KEY || "").trim(),
  clientId: (import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim(),
  discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
  scopes: "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file",
  appId: (import.meta.env.VITE_GOOGLE_APP_ID || "").trim()
};

console.log("🛠️ Google Config Verified:", { 
  keyPrefix: CONFIG.apiKey.substring(0, 7) + "...",
  clientIdPrefix: CONFIG.clientId.substring(0, 10) + "...",
  appId: CONFIG.appId,
  origin: window.location.origin
});

export const REGION_COORDS = {
  "서울": [37.5665, 126.9780], "경기도": [37.2752, 127.0095], "강원도": [37.8228, 128.1555],
  "충남": [36.6588, 126.6728], "충북": [36.6350, 127.4912], "제주도": [33.4996, 126.5312],
  "도쿄": [35.6762, 139.6503], "오사카": [34.6937, 135.5023], "후쿠오카": [33.5902, 130.4017],
  "나고야": [35.1815, 136.9066], "니가타": [37.9162, 139.0364], "홋카이도": [43.0642, 141.3469], "오키나와": [26.2124, 127.6809]
};

// 📦 [LEGACY] Key for one-time localStorage migration
export const DB_KEY = 'kuzmo_events_db';

export const state = {
  map: null,
  clusterGroup: null,
  markers: new Map(),
  theme: localStorage.getItem('app_theme') || 'dark',
  searchQuery: "",
  currentCountry: "Korea",
  currentSubFilter: "전체",
  isAiActive: false,
  showTourist: true, // 📡 [FILTER] 관광류 마커 표시 여부
  showMemory: true,  // 📝 [FILTER] 추억류 마커 표시 여부
  lastRequestId: 0,
  isLockerSynced: localStorage.getItem('is_locker_synced') === 'true',
  lockerFolderName: localStorage.getItem('locker_folder_name') || '01_Archive',
  lockerFolderId: localStorage.getItem('locker_folder_id') || null,
  isServerConnected: false, // 🚀 [NEW] Tracking backend availability
  autoLabelingEnabled: false,
  labelingLogs: [],
  monitorFilter: 'ALL',
  socket: null,
  selectedIds: new Set(),
  selectionStart: null,
  isSelecting: false,
  learningBrain: JSON.parse(localStorage.getItem('ai_learning_brain')) || {
    "@서울": { keywords: ["서울", "강남", "종로", "seoul"], weight: 1.5 },
    "@도쿄": { keywords: ["도쿄", "시부야", "tokyo"], weight: 1.5 },
    "#맛집": { keywords: ["맛집", "먹은", "식당", "푸드"], weight: 1.0 },
    "#기록": { keywords: ["메모", "기록", "노트", "memo", "글"], weight: 1.2 }
  },
  conversationHistory: [], // 🧠 AI 단기 기억 저장소 (최근 5개)
  currentDetailData: null,
  existingIds: new Set() // 🚀 [PERF] Persistent O(1) lookup set for duplicates
};

const INITIAL_STUB_DATA = [];

export let eventStore = INITIAL_STUB_DATA;

/**
 * 🚀 [SMART FACTORY] Load data from IndexedDB
 */
export async function loadStore() {
  try {
    const data = await EventDB.getAll();
    if (data && data.length > 0) {
      eventStore = data;
      eventStore.forEach(ev => state.existingIds.add(String(ev.id)));
      console.log(`📦 [DB] Loaded ${eventStore.length} items from IndexedDB.`);
    } else {
      // Fallback to localStorage if IndexedDB is empty (One-time migration)
      const legacyData = localStorage.getItem(DB_KEY);
      if (legacyData) {
        const parsed = JSON.parse(legacyData);
        eventStore = Array.isArray(parsed) ? parsed : [];
        eventStore.forEach(ev => state.existingIds.add(String(ev.id)));
        console.log(`📦 [DB] Final migration of ${eventStore.length} items from legacy localStorage.`);
        await EventDB.saveAll(eventStore);
        localStorage.removeItem(DB_KEY); // [REMOVED] Clean up legacy trash
      }
    }
  } catch (err) {
    console.error("❌ [DB LOAD ERROR]", err);
  }
}

let saveTimeout = null;
let lastSaveTime = 0;

export function saveToDB(force = false) {
  const now = Date.now();
  const COOLDOWN = 2000; // 2초 쿨다운

  // 🚀 [PERF] 실시간 수혈 중 과도한 I/O 방지를 위한 쓰로틀링
  if (!force && (now - lastSaveTime < COOLDOWN)) {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => saveToDB(true), COOLDOWN);
    return;
  }

  lastSaveTime = now;
  if (saveTimeout) clearTimeout(saveTimeout);

  try {
    // 🚀 [SMART FACTORY] Persistent storage via IndexedDB
    EventDB.saveAll(eventStore).then(() => {
        console.log(`📡 [DB] Successfully saved ${eventStore.length} items to IndexedDB.`);
    });
  } catch (err) {
    console.error("❌ [DB SAVE ERROR]", err);
  }

  // ☁️ [CLOUD DEEP SYNC] 전용 보관함에 자동 백업 (v6.0)
  if (state.isLockerSynced && state.lockerFolderId) {
    import('./auth.js').then(m => m.syncEventsToDrive());
  }
}
