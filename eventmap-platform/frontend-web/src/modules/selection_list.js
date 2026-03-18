import { state, eventStore, saveToDB } from './state.js';
import { showToast, showDetailSheet, renderSubTabs } from './ui.js';
import { syncSelectedEvents, batchUpdateEvents } from './selector.js';

/**
 * 🚀 Selection List Manager (Floating Panel)
 * Consolidates selected pins and provides batch actions.
 */
class SelectionListManager {
    constructor() {
        this.container = null;
        this.initUI();
    }

    initUI() {
        const old = document.getElementById('selection-list-panel');
        if (old) old.remove();

        this.container = document.createElement('div');
        this.container.id = 'selection-list-panel';
        this.container.className = 'glass selection-list-panel';
        this.container.innerHTML = `
            <div class="selection-list-header">
                <div class="header-left">
                    <input type="checkbox" id="panel-select-all" title="Select All" checked>
                    <span>SELECTED (<span id="panel-count">0</span>)</span>
                </div>
                <button class="close-panel-btn">✕</button>
            </div>
            <div id="selection-items-cont" class="selection-items-cont no-scrollbar">
                <p class="empty-msg">지도를 Alt+드래그하여 선택하세요.</p>
            </div>
            <div class="selection-list-footer">
                <div class="process-box">
                    <input type="text" id="panel-batch-tag" placeholder="#태그 추가...">
                    <button id="panel-batch-btn" class="btn-mini">적용</button>
                </div>
                <div class="footer-btns">
                    <button id="batch-copy-btn" class="btn-action">복사</button>
                    <button id="batch-sync-btn" class="btn-action primary">AI 전송</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.container);
        this.setupHandlers();
    }

    setupHandlers() {
        const closeBtn = this.container.querySelector('.close-panel-btn');
        if (closeBtn) closeBtn.onclick = () => this.hide();

        const selectAll = document.getElementById('panel-select-all');
        if (selectAll) {
            selectAll.onchange = (e) => {
                const checked = e.target.checked;
                this.container.querySelectorAll('.card-check').forEach(cb => {
                    cb.checked = checked;
                    cb.closest('.selection-item-card').classList.toggle('selected', checked);
                });
            };
        }

        const syncBtn = document.getElementById('batch-sync-btn');
        if (syncBtn) {
            syncBtn.onclick = () => {
                const ids = this.getSelectedPanelIds();
                if (ids.length > 0) {
                    syncSelectedEvents(ids);
                } else {
                    showToast("처리할 항목을 선택해 주세요.", "info");
                }
            };
        }

        const copyBtn = document.getElementById('batch-copy-btn');
        if (copyBtn) {
            copyBtn.onclick = () => {
                const ids = this.getSelectedPanelIds();
                if (ids.length === 0) return showToast("복사할 항목을 선택하세요.", "info");

                const dataStr = ids.map(id => {
                    const ev = eventStore.find(e => String(e.id) === String(id));
                    return ev ? `📌 [${ev.title}]\n📍 ${ev.region}\n🏷️ ${ev.tags.join(', ')}` : '';
                }).join('\n---\n');

                navigator.clipboard.writeText(dataStr);
                showToast(`${ids.length}개의 데이터가 클립보드로 복사됨`, "success");
            };
        }

        const batchTagBtn = document.getElementById('panel-batch-btn');
        if (batchTagBtn) {
            batchTagBtn.onclick = async () => {
                const tagInput = document.getElementById('panel-batch-tag');
                const rawTag = tagInput?.value.trim();
                if (!rawTag) return;

                const ids = this.getSelectedPanelIds();
                if (ids.length === 0) return showToast("태그를 적용할 항목을 선택하세요.", "info");

                const { count, formatted } = await batchUpdateEvents(ids, rawTag);

                if (count > 0) {
                    this.update();
                    if (tagInput) tagInput.value = '';
                    showToast(`${count}개 항목에 '${formatted}' 태그 적용 및 서버 동기화 완료`, "success");
                }
            };
        }
    }

    getSelectedPanelIds() {
        return Array.from(this.container.querySelectorAll('.card-check:checked'))
            .map(c => c.closest('.selection-item-card').dataset.id);
    }

    update() {
        const cont = document.getElementById('selection-items-cont');
        const countEl = document.getElementById('panel-count');

        if (state.selectedIds.size > 0) {
            this.show();
            if (countEl) countEl.innerText = state.selectedIds.size;
            if (cont) {
                cont.innerHTML = '';
                state.selectedIds.forEach(id => {
                    const ev = eventStore.find(e => String(e.id) === String(id));
                    if (ev) cont.appendChild(this.createCard(ev));
                });
            }
        } else {
            this.hide();
        }
    }

    createCard(ev) {
        const card = document.createElement('div');
        card.className = 'selection-item-card selected';
        card.dataset.id = ev.id;
        card.draggable = true;

        card.innerHTML = `
            <span class="card-drag-handle">⋮⋮</span>
            <input type="checkbox" class="card-check" checked>
            <img src="${ev.imageUrl}" class="item-thumb">
            <div class="item-info">
                <div class="item-title">${ev.title}</div>
                <div class="item-tags">${ev.tags.slice(0, 3).join(' ')}</div>
            </div>
        `;

        card.onclick = (e) => {
            if (e.target.classList.contains('card-check')) {
                card.classList.toggle('selected', e.target.checked);
                return;
            }
            showDetailSheet(ev);
            state.map.flyTo([ev.lat, ev.lng], 15);
        };

        card.addEventListener('dragstart', () => card.classList.add('dragging'));
        card.addEventListener('dragend', () => card.classList.remove('dragging'));

        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            const dragging = document.querySelector('.dragging');
            if (!dragging || dragging === card) return;
            const container = document.getElementById('selection-items-cont');
            const afterElement = this.getDragAfterElement(container, e.clientY);
            if (afterElement == null) {
                container.appendChild(dragging);
            } else {
                container.insertBefore(dragging, afterElement);
            }
        });

        return card;
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.selection-item-card:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    show() { if (this.container) this.container.classList.add('active'); }
    hide() { if (this.container) this.container.classList.remove('active'); }
}

export const selectionList = new SelectionListManager();
