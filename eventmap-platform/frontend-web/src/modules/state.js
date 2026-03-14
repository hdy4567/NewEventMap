/**
 * 🚀 Central State & Constants
 */
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

export const DB_KEY = 'kuzmo_events_db';

export const state = {
  map: null,
  clusterGroup: null,
  markers: new Map(),
  searchQuery: "",
  currentCountry: "Korea",
  currentSubFilter: "전체",
  isAiActive: false,
  lastRequestId: 0,
  isLockerSynced: localStorage.getItem('is_locker_synced') === 'true',
  lockerFolderName: localStorage.getItem('locker_folder_name') || '01_Archive',
  lockerFolderId: localStorage.getItem('locker_folder_id') || null,
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
  currentDetailData: null
};

const INITIAL_STUB_DATA = [
  {
    id: "kr-seoul-1",
    title: "서울 광화문 페스티벌",
    summary: "서울의 심장, 광화문에서 펼쳐지는 전통과 현대의 조화.",
    tags: ["@서울", "#축제", "#전통"],
    lat: 37.5759, lng: 126.9768,
    imageUrl: "https://picsum.photos/seed/seoul/400/300",
    region: "서울", country: "Korea"
  },
  {
    id: "jp-tokyo-1",
    title: "도쿄 시부야 나이트 익스플로러",
    summary: "도쿄의 화려한 밤, 시부야 스크램블 교차로와 숨겨진 맛집 탐방.",
    tags: ["@도쿄", "#시부야", "#야경", "#맛집"],
    lat: 35.6580, lng: 139.7016,
    imageUrl: "https://picsum.photos/seed/tokyo/400/300",
    region: "도쿄", country: "Japan"
  },
  {
    id: "jp-osaka-1",
    title: "오사카 도톤보리 스트리트 푸드",
    summary: "먹다 망한다는 오사카의 진수, 도톤보리 타코야끼 투어.",
    tags: ["@오사카", "#도톤보리", "#먹방", "#맛집"],
    lat: 34.6687, lng: 135.5013,
    imageUrl: "https://picsum.photos/seed/osaka/400/300",
    region: "오사카", country: "Japan"
  },
  {
    id: "jp-okinawa-1",
    title: "오키나와 츄라우미 수족관",
    summary: "세계 최대급 수족관에서 만나는 고래상어와 푸른 바다.",
    tags: ["@오키나와", "#수족관", "#가족여행"],
    lat: 26.6944, lng: 127.8779,
    imageUrl: "https://picsum.photos/seed/okinawa/400/300",
    region: "오키나와", country: "Japan"
  }
];

export let mockEvents = JSON.parse(localStorage.getItem(DB_KEY)) || INITIAL_STUB_DATA;

export function saveToDB() {
  localStorage.setItem(DB_KEY, JSON.stringify(mockEvents));
  console.log("DB Synced: Tags and Event data persisted.");
}
