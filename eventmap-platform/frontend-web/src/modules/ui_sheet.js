import { state, eventStore, saveToDB } from './state.js';
import { showToast } from './ui_base.js';

export function showDetailSheet(data) {
  state.currentDetailData = data;
  const s = document.getElementById('detail-sheet');
  if (!s) return;
  
  const titleEl = document.getElementById('sheet-title');
  const imgEl = document.getElementById('sheet-image');
  const badgeEl = document.getElementById('sheet-region-badge');
  const summaryInput = document.getElementById('sheet-summary');
  const timeEl = document.getElementById('sheet-timestamp');
  const audioSlot = document.getElementById('sheet-audio-slot');
  const delBtn = document.getElementById('sheet-delete-btn');
  const tagCont = document.getElementById('sheet-tags');

  // 1. Basic Info
  if (titleEl) titleEl.innerText = data.title;
  if (imgEl) imgEl.src = data.imageUrl && data.imageUrl !== 'null' ? data.imageUrl : "https://picsum.photos/seed/" + data.id + "/800/400";
  if (badgeEl) badgeEl.innerText = data.region || data.country || "기록";
  if (timeEl) timeEl.innerText = new Date(data.timestamp || Date.now()).toLocaleString('ko-KR');

  // 2. Content Edition (Real-time Save)
  if (summaryInput) {
    summaryInput.value = data.content || data.summary || data.description || "";
    
    // Cleanup previous listeners to prevent leaks
    const newSummaryInput = summaryInput.cloneNode(true);
    summaryInput.parentNode.replaceChild(newSummaryInput, summaryInput);
    
    newSummaryInput.oninput = (e) => {
        const val = e.target.value;
        const targetId = data.id;
        // Update local object
        data.summary = val;
        data.description = val;
        data.content = val;

        // Sync with eventStore
        const idx = eventStore.findIndex(ev => String(ev.id) === String(targetId));
        if (idx !== -1) {
            eventStore[idx].summary = val;
            eventStore[idx].description = val;
            eventStore[idx].content = val;
            saveToDB(); 
        }
    };
  }

  // 3. Audio Slot Handle
  if (audioSlot) {
    if (data.audioUrl) {
      audioSlot.style.display = 'block';
      audioSlot.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <button class="icon-btn-sm" onclick="new Audio('${data.audioUrl}').play()">▶️</button>
          <span style="font-size: 11px; color: var(--primary-glow); font-weight: 800;">음성 기록 재생</span>
        </div>
      `;
    } else {
      audioSlot.style.display = 'none';
    }
  }

  // 4. Delete Action
  if (delBtn) {
    delBtn.onclick = () => {
        if (window.Kuzmo && window.Kuzmo.deleteEvent) {
            window.Kuzmo.deleteEvent(data.id);
        }
        s.classList.remove('active');
    };
  }

  // 5. Tags
  if (tagCont) {
    tagCont.innerHTML = `
      ${data.tags.map(t => `<span class="tag clickable" onclick="window.filterByTag('${t}')">${t}<span class="tag-del" onclick="event.stopPropagation(); window.removeTag('${t}')">✕</span></span>`).join('')}
      <span class="tag-add" onclick="window.addNewTagPrompt()">＋</span>
    `;
  }

  s.classList.add('active');
}

export function openQuickNote() {
    const rawInput = prompt("💡 [제목 @태그] 형식으로 핵심 메모를 입력하세요 (예: 맛집탐방 @강남)");
    if (!rawInput) return;

    let title = rawInput.trim();
    let content = "내용 없음";
    let tags = ["#직접입력"];

    if (rawInput.includes('@')) {
        const parts = rawInput.split('@');
        title = parts[0].trim() || "메모";
        content = parts[1].trim() || "내용 없음";
        if (content !== "내용 없음") tags.push(`@${content}`);
    }

    const center = state.map.getCenter();
    const newEv = {
        id: "mem_" + Date.now(),
        title,
        description: content,
        summary: content,
        lat: center.lat,
        lng: center.lng,
        tags,
        region: "Manual Deck",
        timestamp: Date.now(),
        imageUrl: "null"
    };

    eventStore.push(newEv);
    state.existingIds.add(String(newEv.id));
    import('./map.js').then(m => m.addMarkerToMap(newEv));
    saveToDB();
    import('./ui.js').then(u => u.showToast(`'${title}' 메모 추가됨`, "success"));
    
    if (document.body.classList.contains('view-locker')) {
        import('./ui_locker.js').then(m => m.renderLockerSlots());
    }
}

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

export function showRegionGlow(region) {
    const glow = document.getElementById('region-glow');
    if (!glow) return;
    const badge = glow.querySelector('.glow-badge');
    if (badge) badge.innerText = region;
    glow.classList.add('active');
    setTimeout(() => glow.classList.remove('active'), 2500);
}
