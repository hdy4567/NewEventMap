import { state, eventStore } from './state.js';
import { filterMarkers } from './search.js';

export function showToast(msg, type = 'info') {
  const cont = document.getElementById('toast-container');
  if (!cont) return;
  const t = document.createElement('div');
  t.className = `toast glass ${type} fade-in`;
  t.innerText = msg;
  cont.appendChild(t);
  setTimeout(() => { t.classList.add('fade-out'); setTimeout(() => t.remove(), 500); }, 3000);
}

export function updateSelectionBar() {
  const bar = document.getElementById('selection-action-bar');
  const countEl = document.getElementById('selected-count');
  if (!bar || !countEl) return;
  if (state.selectedIds.size > 0) {
    bar.classList.add('active');
    countEl.innerText = state.selectedIds.size;
  } else {
    bar.classList.remove('active');
  }
}

export function switchMode(mode) {
    const body = document.body;
    const mapTab = document.getElementById('mode-map');
    const lockerTab = document.getElementById('mode-locker');
    if (!mapTab || !lockerTab) return;

    if (mode === 'MAP') {
        body.classList.remove('view-locker');
        mapTab.classList.add('active');
        lockerTab.classList.remove('active');
    } else {
        body.classList.add('view-locker');
        mapTab.classList.remove('active');
        lockerTab.classList.add('active');
        // Lazy load locker slots & Sync UI visibility
        import('./ui_locker.js').then(m => {
            m.renderLockerSlots();
            m.updateLockerStatus();
        });
    }
}

export function renderSubTabs() {
  const cont = document.getElementById('sub-tabs');
  if (!cont) return;
  let items = [];
  if (state.currentCountry === "Korea") {
    items = ["전체", "서울", "경기도", "강원도", "충남", "충북", "제주도"];
  } else if (state.currentCountry === "Japan") {
    items = ["전체", "도쿄", "오사카", "후쿠오카", "나고야", "니가타", "홋카이도", "오키나와"];
  } else {
    const globalTags = new Set(["전체"]);
    eventStore.forEach(e => {
      if (e.tags) e.tags.forEach(t => globalTags.add(t.startsWith('@') ? t : `@${t}`));
    });
    items = Array.from(globalTags).concat(["＋"]);
  }
  cont.innerHTML = items.map(t => `<div class="sub-tab ${state.currentSubFilter === t ? 'active' : ''}" onclick="window.setSubFilter('${t}')">${t}</div>`).join('');
}

export function toggleAiChat(force) {
    const panel = document.getElementById('chat-panel');
    const fab = document.getElementById('chat-fab');
    if (!panel || !fab) return;
    state.isAiActive = typeof force === 'boolean' ? force : !state.isAiActive;
    panel.classList.toggle('active', state.isAiActive);
}

export function setupFilterHandlers() {
    const tourCk = document.getElementById('filter-tourist');
    const memoCk = document.getElementById('filter-memory');
    if (tourCk) tourCk.onchange = (e) => { state.showTourist = e.target.checked; filterMarkers(); };
    if (memoCk) memoCk.onchange = (e) => { state.showMemory = e.target.checked; filterMarkers(); };
}
