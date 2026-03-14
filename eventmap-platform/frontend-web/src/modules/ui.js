import { state, mockEvents, saveToDB } from './state.js';
import { filterMarkers, flyToFilteredResults } from './search.js';
import { updateMarkerUI } from './map.js';

/**
 * 🎨 UI Rendering & Event Handlers
 */

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

export function showDetailSheet(data) {
  state.currentDetailData = data;
  const s = document.getElementById('detail-sheet');
  if (!s) return;
  
  document.getElementById('sheet-title').innerText = data.title;
  document.getElementById('sheet-image').src = data.imageUrl;
  document.getElementById('sheet-region-badge').innerText = data.region || data.country || "기록";

  const tagCont = document.getElementById('sheet-tags');
  tagCont.innerHTML = `
    ${data.tags.map(t => `<span class="tag clickable" onclick="window.filterByTag('${t}')">${t}<span class="tag-del" onclick="event.stopPropagation(); window.removeTag('${t}')">✕</span></span>`).join('')}
    <span class="tag-add" onclick="window.addNewTagPrompt()">＋</span>
  `;
  s.classList.add('active');
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
    mockEvents.forEach(e => {
      if (e.tags) e.tags.forEach(t => globalTags.add(t.startsWith('@') ? t : `@${t}`));
    });
    items = Array.from(globalTags).concat(["＋"]);
  }

  cont.innerHTML = items.map(t => `<div class="sub-tab ${state.currentSubFilter === t ? 'active' : ''}" onclick="window.setSubFilter('${t}')">${t}</div>`).join('');
}

export async function renderLockerSlots() {
    const grid = document.getElementById('locker-slots'); // index.html와 ID 일치시킴
    if (!grid) return;
    
    grid.innerHTML = '<p style="grid-column: span 3; font-size: 10px; opacity: 0.5; text-align: center;">파일 불러오는 중...</p>';
    
    const { fetchFilesInFolder } = await import('./auth.js');
    const files = await fetchFilesInFolder(state.lockerFolderId);
    
    grid.innerHTML = '';
    
    if (files.length === 0) {
        grid.innerHTML = '<p style="grid-column: span 3; font-size: 10px; opacity: 0.5; text-align: center; padding: 20px;">폴더가 비어있습니다.</p>';
        // 빈 슬롯이라도 보여주고 싶다면 루프 추가 가능하지만, 리얼 로직 우선
        return;
    }

    files.forEach(file => {
        const isImage = file.mimeType.startsWith('image/');
        const slot = document.createElement('div');
        slot.className = 'slot clickable'; // style.css의 .slot 클래스 사용
        slot.onclick = () => window.open(file.webViewLink, '_blank');
        
        slot.innerHTML = `
            <div class="slot-inner">
                ${isImage && file.thumbnailLink 
                    ? `<img src="${file.thumbnailLink}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;">` 
                    : `<span class="slot-icon">${getFileIcon(file.mimeType)}</span>`
                }
                <span class="slot-label" style="display:block; width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align:center;">${file.name}</span>
            </div>
        `;
        grid.appendChild(slot);
    });
}

function getFileIcon(mimeType) {
    if (mimeType.includes('pdf')) return '📕';
    if (mimeType.includes('text')) return '📄';
    if (mimeType.includes('audio')) return '🎵';
    if (mimeType.includes('video')) return '🎬';
    if (mimeType.includes('folder')) return '📁';
    return '📦';
}

export function showRegionGlow(region) {
    const glow = document.getElementById('region-glow');
    if (!glow) return;
    const badge = glow.querySelector('.glow-badge');
    badge.innerText = region;
    glow.classList.add('active');
    setTimeout(() => glow.classList.remove('active'), 2500);
}

// 🚀 복구된 태그 관리 로직
export function addNewTagPrompt() {
  const newTag = prompt("새로운 태그를 입력하세요 (예: @중요):");
  if (!newTag) return;
  const formatted = newTag.startsWith('@') ? newTag : `@${newTag}`;
  if (!state.currentDetailData.tags.includes(formatted)) {
    state.currentDetailData.tags.push(formatted);
    saveToDB();
    showDetailSheet(state.currentDetailData);
    showToast(`태그 '${formatted}' 추가됨`, 'success');
  }
}

export function removeTag(tag) {
  state.currentDetailData.tags = state.currentDetailData.tags.filter(t => t !== tag);
  saveToDB();
  showDetailSheet(state.currentDetailData);
  showToast(`태그 '${tag}' 삭제됨`, 'info');
}
// 📦 보관함(Locker) UI 제어
export function setupLockerHandlers() {
    const storageBtn = document.getElementById('storage-btn');
    const lockerPanel = document.getElementById('locker-panel');
    const closeBtn = document.getElementById('close-locker');
    const closeUnsyncedBtn = document.getElementById('close-locker-unsynced');

    if (storageBtn) {
        storageBtn.onclick = () => {
            lockerPanel.classList.toggle('active');
            updateLockerStatus();
        };
    }

    [closeBtn, closeUnsyncedBtn].forEach(btn => {
        if (btn) btn.onclick = () => lockerPanel.classList.remove('active');
    });

    // 🚀 New Handlers for Folder Picker
    const refreshBtn = document.getElementById('refresh-folders-btn');
    const selectBtn = document.getElementById('select-folder-btn');
    const changeBtn = document.getElementById('change-folder-btn');

    if (refreshBtn) refreshBtn.onclick = () => window.refreshFolderList();
    if (selectBtn) selectBtn.onclick = async () => {
        const { showPicker } = await import('./auth.js');
        showPicker();
    };
    if (changeBtn) changeBtn.onclick = () => {
        state.lockerFolderName = null;
        updateLockerStatus();
    };
}

export function updateLockerStatus() {
    const unsynced = document.getElementById('locker-unsynced');
    const content = document.getElementById('locker-synced-content');
    const folderPicker = document.getElementById('locker-folder-picker');

    if (state.isLockerSynced) {
        if (state.lockerFolderName && state.lockerFolderName !== '01_Archive') {
            unsynced.style.display = 'none';
            folderPicker.style.display = 'none';
            content.style.display = 'flex';
            renderLockerSlots();
        } else {
            unsynced.style.display = 'none';
            folderPicker.style.display = 'flex';
            window.refreshFolderList();
        }
    } else {
        unsynced.style.display = 'flex';
        content.style.display = 'none';
        folderPicker.style.display = 'none';
    }
}

export async function refreshFolderList() {
    const container = document.getElementById('folder-list-container');
    if (!container) return;
    
    container.innerHTML = '<p style="font-size: 11px; opacity: 0.5;">Loading folders...</p>';
    
    // auth.js의 fetchDriveFolders 호출 (글로벌 export 되어있어야 함)
    // 여기서는 간단하게 dynamic import 또는 이미 로드된 모듈 사용
    const { fetchDriveFolders } = await import('./auth.js');
    const folders = await fetchDriveFolders();
    
    if (folders.length === 0) {
        container.innerHTML = '<p style="font-size: 11px; color: var(--error);">No folders found.</p>';
        return;
    }

    container.innerHTML = folders.map(f => `
        <div class="folder-item clickable" data-name="${f.name}" data-id="${f.id}" onclick="window.highlightFolderItem(this)">
            <span class="folder-icon">📁</span>
            <span class="folder-name">${f.name}</span>
        </div>
    `).join('');
}

window.highlightFolderItem = (el) => {
    document.querySelectorAll('.folder-item').forEach(item => item.classList.remove('active-selection'));
    el.classList.add('active-selection');
};

export function selectLockerFolder(name, id) {
    state.lockerFolderName = name;
    state.lockerFolderId = id;
    localStorage.setItem('locker_folder_name', name);
    localStorage.setItem('locker_folder_id', id);
    showToast(`연동 폴더: ${name}`, 'success');
    updateLockerStatus();
}

// 🚀 인덱스 파일에서 호출할 글로벌 노출
window.showFolderPicker = () => {
    const { handleAuthClick } = import('./auth.js').then(m => m.handleAuthClick());
};
window.hideFolderPicker = () => {
    document.getElementById('locker-panel').classList.remove('active');
};
window.refreshFolderList = refreshFolderList;
window.selectLockerFolder = selectLockerFolder;
