import { state, eventStore, saveToDB } from './state.js';
import { switchMode, showDetailSheet, showToast } from './ui.js';
import { updateSelectionBar } from './ui.js';
import { eventToMarkdown, syncToLocalFilesystem } from './utils.js';

export function setupLockerHandlers() {
    const storageBtn = document.getElementById('storage-btn');
    const lockerPanel = document.getElementById('locker-panel');
    const closeBtn = document.getElementById('close-locker');
    const closeUnsyncedBtn = document.getElementById('close-locker-unsynced');

    if (storageBtn) {
        storageBtn.onclick = () => {
            lockerPanel.classList.toggle('active');
            updateLockerStatus();
            if (lockerPanel.classList.contains('active')) {
                renderLockerSlots();
            }
        };
    }

    [closeBtn, closeUnsyncedBtn].forEach(btn => {
        if (btn) btn.onclick = () => lockerPanel.classList.remove('active');
    });

    const refreshBtn = document.getElementById('refresh-folders-btn');
    const selectBtn = document.getElementById('select-folder-btn');
    const changeBtn = document.getElementById('change-folder-btn');
    const deckSearch = document.getElementById('deck-search');

    if (refreshBtn) refreshBtn.onclick = () => import('./auth.js').then(m => m.refreshFolderList());
    if (selectBtn) selectBtn.onclick = async () => {
        const activeItem = document.querySelector('.folder-item.active-selection');
        if (activeItem) {
            const name = activeItem.getAttribute('data-name');
            const id = activeItem.getAttribute('data-id');
            selectLockerFolder(name, id);
        } else {
            const { showPicker } = await import('./auth.js');
            showPicker();
        }
    };
    if (changeBtn) changeBtn.onclick = () => {
        state.lockerFolderName = null;
        state.lockerFolderId = null;
        updateLockerStatus();
    };

    if (deckSearch) {
        deckSearch.oninput = (e) => {
            const query = e.target.value.toLowerCase();
            document.querySelectorAll('.locker-card').forEach(card => {
                const text = card.innerText.toLowerCase();
                card.style.display = text.includes(query) ? 'block' : 'none';
            });
        };
    }

    const filterChips = document.querySelectorAll('.deck-filter-chip');
    filterChips.forEach(chip => {
        chip.onclick = () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const filter = chip.getAttribute('data-filter');

            // 🗺️ Sync with MAP VIEW
            if (filter === 'tourist' || filter === 'memory') {
                state.showTourist = (filter === 'tourist');
                state.showMemory = (filter === 'memory');
                const tourCk = document.getElementById('filter-tourist');
                const memoCk = document.getElementById('filter-memory');
                if (tourCk) tourCk.checked = state.showTourist;
                if (memoCk) memoCk.checked = state.showMemory;
                import('./search.js').then(m => m.filterMarkers());
            } else if (filter === 'all') {
                state.showTourist = true; state.showMemory = true;
                const tourCk = document.getElementById('filter-tourist');
                const memoCk = document.getElementById('filter-memory');
                if (tourCk) { tourCk.checked = true; memoCk.checked = true; }
                import('./search.js').then(m => m.filterMarkers());
            }

            document.querySelectorAll('.locker-card').forEach(card => {
                const type = card.dataset.markerType || 'unknown';
                if (filter === 'all') card.style.display = 'block';
                else if (filter === 'tourist') card.style.display = type === 'tourist' ? 'block' : 'none';
                else if (filter === 'memory') card.style.display = type === 'memory' ? 'block' : 'none';
                else if (filter === 'image') card.style.display = card.querySelector('.card-media') ? 'block' : 'none';
                else if (filter === 'pin') card.style.display = card.innerText.includes('📌') ? 'block' : 'none';
                else card.style.display = 'block';
            });

            setTimeout(() => {
                document.querySelectorAll('.locker-card').forEach(c => resizeGridItem(c));
            }, 100);
        };
    });

    // 🖱️ Initialize Deck Drag Selection
    setupDeckSelection();
}

/**
 * 🖱️ MEMOREAL (Notes Deck) Alt+Drag Selection System
 */
function setupDeckSelection() {
    let isSelecting = false;
    let startPoint = { x: 0, y: 0 };
    const box = document.getElementById('selection-box');
    const lockerSlots = document.getElementById('locker-slots');

    if (!lockerSlots || !box) return;

    lockerSlots.addEventListener('mousedown', (e) => {
        if (e.altKey && e.button === 0) { // Alt + Left Click
            isSelecting = true;
            startPoint = { x: e.clientX, y: e.clientY };
            box.style.display = 'block';
            box.style.left = startPoint.x + 'px';
            box.style.top = startPoint.y + 'px';
            box.style.width = '0px';
            box.style.height = '0px';

            // Clear previous map/deck selection
            import('./selector.js').then(m => m.clearSelection());

            e.preventDefault(); // Prevent text selection
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!isSelecting) return;
        const currentX = e.clientX;
        const currentY = e.clientY;

        const x = Math.min(startPoint.x, currentX);
        const y = Math.min(startPoint.y, currentY);
        const w = Math.abs(currentX - startPoint.x);
        const h = Math.abs(currentY - startPoint.y);

        box.style.left = x + 'px';
        box.style.top = y + 'px';
        box.style.width = w + 'px';
        box.style.height = h + 'px';
    });

    // (Redundant 'copy' listener removed - handled centrally in selector.js)

    document.addEventListener('mouseup', (e) => {
        if (!isSelecting) return;
        isSelecting = false;
        box.style.display = 'none';

        const rect = {
            left: Math.min(startPoint.x, e.clientX),
            right: Math.max(startPoint.x, e.clientX),
            top: Math.min(startPoint.y, e.clientY),
            bottom: Math.max(startPoint.y, e.clientY)
        };

        // Find cards bounding rect that overlap with selection box
        const cards = document.querySelectorAll('.locker-card');
        const selectedIds = new Set();

        cards.forEach(card => {
            const r = card.getBoundingClientRect();
            const isOverlapping = !(r.right < rect.left ||
                r.left > rect.right ||
                r.bottom < rect.top ||
                r.top > rect.bottom);
            if (isOverlapping) {
                card.classList.add('selected'); // Highlight visually using CSS class
                selectedIds.add(card.dataset.id);
            }
        });

        if (selectedIds.size > 0) {
            state.selectedIds = selectedIds; // 🚀 Sync update to ensure dragstart catches it
            import('./selector.js').then(m => {
                m.finishSelection(e); // Trigger action bar and list update
                updateSelectionBar();
            });
        }
    });
}


export function updateLockerStatus() {
    const unsyncedView = document.getElementById('locker-unsynced');
    const pickerView = document.getElementById('locker-folder-picker');
    const syncedContent = document.getElementById('locker-synced-content');
    if (!unsyncedView || !syncedContent || !pickerView) return;

    if (!state.isLockerSynced) {
        unsyncedView.style.display = 'flex'; syncedContent.style.display = 'none'; pickerView.style.display = 'none';
    } else if (!state.lockerFolderId) {
        unsyncedView.style.display = 'none'; syncedContent.style.display = 'none'; pickerView.style.display = 'block';
    } else {
        unsyncedView.style.display = 'none'; syncedContent.style.display = 'flex'; pickerView.style.display = 'none';
        const titleEl = document.querySelector('.locker-title');
        if (titleEl) titleEl.innerText = state.lockerFolderName?.toUpperCase() || "TRAVEL DECK";
    }
}

export function selectLockerFolder(name, id) {
    state.lockerFolderName = name;
    state.lockerFolderId = id;
    localStorage.setItem('locker_folder_name', name);
    localStorage.setItem('locker_folder_id', id);
    showToast(`연동 폴더: ${name}`, 'success');
    updateLockerStatus();
}

/**
 * 📂 [CLOUD] 드라이브 폴더 목록 새로고침
 */
export async function refreshFolderList() {
    const container = document.getElementById('folder-list-container');
    if (!container) return;

    container.innerHTML = '<p style="font-size: 11px; opacity: 0.5; text-align:center; padding:10px;">구글 드라이브 폴더 목록 읽는 중...</p>';

    try {
        const { fetchDriveFolders } = await import('./auth.js');
        const folders = await fetchDriveFolders();

        if (folders.length === 0) {
            container.innerHTML = '<p style="font-size: 11px; opacity: 0.5; text-align:center; padding:10px;">폴더를 찾을 수 없습니다.</p>';
            return;
        }

        container.innerHTML = folders.map(f => `
            <div class="folder-item" data-id="${f.id}" data-name="${f.name}" onclick="this.parentElement.querySelectorAll('.folder-item').forEach(i=>i.classList.remove('active-selection')); this.classList.add('active-selection');">
                <span class="folder-icon">📁</span>
                <span class="folder-name">${f.name}</span>
            </div>
        `).join('');
    } catch (err) {
        console.error("Failed to refresh folder list:", err);
        container.innerHTML = '<p style="font-size: 11px; color: var(--error); text-align:center;">목록 갱신 실패</p>';
    }
}

// 🚀 [PERF] Infinite Scroll State
export let lockerItems = [];
export let lockerCursor = 0;
export const LOCKER_BATCH_SIZE = 50;
export let lockerObserver = null;

export async function renderLockerSlots() {
    const grid = document.getElementById('locker-slots');
    if (!grid) return;

    grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:50px; opacity:0.5; font-size:12px;">덱(Deck) 데이터를 최적화하여 읽어오는 중...</div>';

    const { fetchFilesInFolder } = await import('./auth.js');
    const files = await fetchFilesInFolder(state.lockerFolderId);

    grid.innerHTML = '<div class="locker-content-view" id="deck-grid" style="display: grid; width: 100%;"></div>';
    const container = document.getElementById('deck-grid');
    console.log(`🗃️ [DECK] Initializing Grid for ${state.lockerFolderId || 'LOCAL ONLY'}...`);

    const allItems = [];
    eventStore.forEach((ev) => {
        // 🔑 마커 타입: ev.type (신규) 또는 id prefix fallback (레거시 호환)
        const evType = ev.type || (() => {
            const id = String(ev.id || '');
            if (id.startsWith('s-db-')) return 'tourist';
            if (id.startsWith('kuzmo-')) return 'memory';
            return 'unknown';
        })();

        allItems.push({
            id: ev.id,
            title: ev.title || "Untitled Memo",
            summary: ev.summary || "",
            content: ev.content || "내용 없음",
            tags: ev.tags || [],
            region: ev.region || "Unknown",
            timestamp: ev.timestamp || ev.date || Date.now(), // 📅 [FIX] Fallback for Invalid Date
            imageUrl: ev.imageUrl,
            markerType: evType,
            data: ev,
            source: 'LOCAL'
        });
    });

    if (allItems.length === 0) {
        grid.innerHTML = '<div style="padding:100px 20px; text-align:center; opacity:0.3; font-size:12px;">보관함이 비어있습니다.</div>';
        return;
    }

    lockerItems = allItems;
    lockerCursor = 0;
    if (lockerObserver) lockerObserver.disconnect();

    container.innerHTML = '';
    renderLockerBatch();
    setupLockerInfinityScroll();

    setupDragAndDrop(container);

    const actionBar = document.getElementById('deck-action-bar');
    if (actionBar) {
        actionBar.style.display = eventStore.length >= 3 ? 'block' : 'none';
    }
}

export function renderLockerBatch() {
    const container = document.getElementById('deck-grid');
    if (!container) return;

    const batch = lockerItems.slice(lockerCursor, lockerCursor + LOCKER_BATCH_SIZE);
    if (batch.length === 0) return;

    const fragment = document.createDocumentFragment();

    batch.forEach(item => {
        const card = document.createElement('div');
        const colors = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'];
        const idStr = String(item.id);
        const colorIdx = Math.abs(idStr.split('').reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0)) % colors.length;

        card.className = `locker-card keep-${colors[colorIdx]} fade-in ${state.selectedIds.has(item.id) ? 'selected' : ''}`;
        card.draggable = true;
        card.dataset.id = item.id;
        card.dataset.markerType = item.markerType || 'unknown'; // Tourist / Memory 분류

        const hasMedia = item.imageUrl && item.imageUrl !== 'null';
        const hasAudio = item.data && item.data.audioUrl;
        const contentText = item.content && item.content !== '내용 없음' ? item.content : (item.summary || '');

        card.innerHTML = `
            ${hasMedia ? `<div class="card-media"><img src="${item.imageUrl}" draggable="false" loading="lazy" onload="window.Kuzmo.resizeGridItem(this.closest('.locker-card'))"></div>` : ''}
            <div class="card-title">${item.title}</div>
            <div class="card-body">
                ${contentText ? `<div class="card-content">${contentText}</div>` : ''}
                <div class="card-labels">
                    ${item.region ? `<span class="card-label">📍 ${item.region}</span>` : ''}
                    ${item.tags.slice(0, 3).map(t => `<span class="card-label" style="opacity:0.6">${t}</span>`).join('')}
                </div>
            </div>
            <div class="card-actions">
                <button class="card-action-btn" onclick="Kuzmo.deleteEvent('${item.id}')">✕</button>
            </div>
            <div class="card-timestamp">${new Date(item.timestamp).toLocaleDateString('ko-KR')}</div>
        `;

        card.onclick = (e) => {
            if (e.target.closest('.card-action-btn')) return;
            // 🎯 [MULTI-SELECT] Ctrl + Click
            if (e.ctrlKey) {
                const isSelected = state.selectedIds.has(item.id);
                if (isSelected) {
                    state.selectedIds.delete(item.id);
                    card.classList.remove('selected');
                } else {
                    state.selectedIds.add(item.id);
                    card.classList.add('selected');
                }
                updateSelectionBar();
                return;
            }
            if (item.source === 'LOCAL') {
                switchMode('MAP');
                showDetailSheet(item.data);
                state.map.flyTo([item.data.lat, item.data.lng], 14);
            }
        };

        // 🛡️ [NATIVE-FILE-DRAG] (v2025.3.18.11500)
        // This makes the browser treat the web cards EXACTLY like Desktop files.
        card.ondragstart = (e) => {
            card.classList.add('dragging');
            const targetIds = state.selectedIds.has(item.id) ? Array.from(state.selectedIds) : [item.id];
            const selectedItems = targetIds.map(id => eventStore.find(ev => String(ev.id) === String(id))).filter(Boolean);
            if (selectedItems.length === 0) return;

            // 1. 🛰️ [SERVERLESS-SYNC] Dispatch to Extension Bridge (Zero-Server)
            window.dispatchEvent(new CustomEvent('KuzmoSync', { detail: selectedItems }));

            // 2. ⚡ [NATIVE-INJECTION] Create real File blobs for the Browser Drag Engine
            const exportData = selectedItems.map(item => ({
                title: item.title,
                content: eventToMarkdown(item),
                fileName: `${item.title.replace(/[\/\\?%*:|"<>\s]/g, '_')}.md`
            }));

            // 🚀 [THE-HOLY-GRAIL] DownloadURL Trick (Bypasses origin security)
            // This makes the browser/OS think we are dragging a REAL file from the server
            const downloadUrlData = exportData.map(item => {
                // We create a temporary blob URL for each file
                const blob = new Blob([item.content], { type: 'text/markdown' });
                const blobUrl = URL.createObjectURL(blob);
                return `text/markdown:${item.fileName}:${blobUrl}`;
            }).join('\n');

            // 📑 [MULTI-PROTOCOL] Support legacy, extension, and native OS drag
            e.dataTransfer.setData("DownloadURL", downloadUrlData);
            e.dataTransfer.setData("application/kuzmo-file", JSON.stringify(exportData));
            
            selectedItems.forEach(item => {
                const mdContent = eventToMarkdown(item);
                const file = new File([mdContent], `${item.title}.md`, { type: 'text/markdown' });
                try { e.dataTransfer.items.add(file); } catch (err) {}
            });
            
            e.dataTransfer.effectAllowed = "all"; 
            e.dataTransfer.dropEffect = "copy";
            e.dataTransfer.setData("text/plain", `[KUZMO] ${selectedItems.length}`); 
            
            showToast(`${selectedItems.length}개 메모가 '실물 파일'로 변환되었습니다. AI 창에 드롭하세요!`, "success");
        };

        fragment.appendChild(card);
        setTimeout(() => resizeGridItem(card), 10);
    });

    container.appendChild(fragment);
    lockerCursor += batch.length;
    const sentinel = document.getElementById('locker-sentinel');
    if (sentinel) container.appendChild(sentinel);
}

export function setupLockerInfinityScroll() {
    const container = document.getElementById('deck-grid');
    if (!container) return;
    let sentinel = document.getElementById('locker-sentinel') || document.createElement('div');
    sentinel.id = 'locker-sentinel';
    container.appendChild(sentinel);

    lockerObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && lockerCursor < lockerItems.length) {
            renderLockerBatch();
        }
    }, { root: document.getElementById('locker-slots'), threshold: 0.1 });
    lockerObserver.observe(sentinel);
}

export function resizeGridItem(item) {
    const grid = document.getElementById('deck-grid');
    if (!grid || !item) return;
    const rowHeight = 10, rowGap = 16;
    const totalH = item.scrollHeight;
    const rowSpan = Math.ceil(totalH / (rowHeight + rowGap));
    item.style.gridRowEnd = "span " + rowSpan;
}

function setupDragAndDrop(container) {
    let draggedItem = null;
    container.addEventListener('dragstart', (e) => {
        draggedItem = e.target.closest('.locker-card');
        draggedItem?.classList.add('dragging');
    });
    container.addEventListener('dragend', () => draggedItem?.classList.remove('dragging'));
    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(container, e.clientY);
        if (draggedItem) {
            if (afterElement == null) container.appendChild(draggedItem);
            else container.insertBefore(draggedItem, afterElement);
        }
    });
}

function getDragAfterElement(container, y) {
    const draggables = [...container.querySelectorAll('.locker-card:not(.dragging)')];
    return draggables.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset, element: child };
        return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}
