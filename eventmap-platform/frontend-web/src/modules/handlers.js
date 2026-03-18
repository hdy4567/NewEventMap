import { state, eventStore, saveToDB } from './state.js';
import { 
  finishSelection, clearSelection, 
  deleteSelectedEvents, syncSelectedEvents,
  applyBatchTags
} from './selector.js';
import { filterMarkers, flyToFilteredResults } from './search.js';

/**
 * ⌨️ Global Event Handlers
 */

export async function setupEventListeners() {
  // 🏁 App-wide Mouse Interaction Recovery
  window.addEventListener('mouseup', (e) => {
    if (state.isSelecting) finishSelection(e);
    else resetAllInteractions();
  });
  
  window.addEventListener('keydown', (e) => {
    // 1. ESC: 취소
    if (e.key === 'Escape') {
      clearSelection();
      const sheet = document.getElementById('detail-sheet');
      if (sheet) sheet.classList.remove('active');
      resetAllInteractions();
    }
    
    // 2. Delete: 대량 삭제
    if (e.key === 'Delete') {
      deleteSelectedEvents();
    }

    // 3. Enter: 대량 동기화 (Input 포커스 없을 때만)
    if (e.key === 'Enter' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      syncSelectedEvents();
    }
    if (e.key === 'Enter' && document.activeElement.id === 'batch-tag-input') {
      applyBatchTags();
    }
  });

  // Search Input Handler
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.oninput = (e) => {
      state.searchQuery = e.target.value;
      filterMarkers();
    };
    searchInput.onkeydown = (e) => {
      if (e.key === 'Enter') flyToFilteredResults();
    };
  }

  // 🖱 Selection Bar Button Handlers
  const applyTagsBtn = document.getElementById('apply-batch-tags');
  const deleteBtn = document.getElementById('delete-selection');
  const clearBtn = document.getElementById('clear-selection');

  if (applyTagsBtn) applyTagsBtn.onclick = applyBatchTags;
  if (deleteBtn) deleteBtn.onclick = deleteSelectedEvents;
  if (clearBtn) clearBtn.onclick = clearSelection;

  const batchTagInput = document.getElementById('batch-tag-input');
  if (batchTagInput) {
    batchTagInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyBatchTags();
      }
    };
  }
  // 🤖 AI Chat Handlers
  const aiToggleBtn = document.getElementById('ai-toggle-btn');
  const chatFab = document.getElementById('chat-fab');
  const closeChat = document.getElementById('close-chat');
  const sendChat = document.getElementById('send-chat');
  const chatInput = document.querySelector('.chat-input');
  
  const { toggleAiChat } = await import('./ui.js');

  if (aiToggleBtn) aiToggleBtn.onclick = () => toggleAiChat();
  if (chatFab) chatFab.onclick = () => toggleAiChat();
  if (closeChat) closeChat.onclick = () => toggleAiChat(false);
  
  const sendMessage = () => {
    if (!chatInput || !chatInput.value.trim()) return;
    const text = chatInput.value.trim();
    
    // UI에 내 메시지 즉시 추가
    const chatMsgCont = document.getElementById('chat-messages');
    if (chatMsgCont) {
        const myMsg = document.createElement('div');
        myMsg.className = 'message user';
        myMsg.innerText = text;
        chatMsgCont.appendChild(myMsg);
        chatMsgCont.scrollTop = chatMsgCont.scrollHeight;
    }
    
    // 🦾 온디바이스 AI 스마트 처리 요청
    if (state.worker) {
        state.worker.postMessage({
            action: 'AI_SMART_PROCESS',
            text: text,
            history: state.conversationHistory,
            events: eventStore,
            learningData: state.learningBrain,
            localTime: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', hour12: false })
        });
    }

    // 서버에도 전송 (백업)
    if (state.socket && state.socket.readyState === WebSocket.OPEN) {
        state.socket.send(JSON.stringify({ 
            type: "AI_CHAT_MESSAGE", 
            text: text,
            requestId: Date.now()
        }));
    }
    
    chatInput.value = "";
  };

  if (sendChat) sendChat.onclick = sendMessage;
  if (chatInput) {
    chatInput.onkeydown = (e) => {
        if (e.key === 'Enter') sendMessage();
    };
  }

  // 🧠 [NEW] AI Labeling Monitor Handlers (v13.0)
  const labelToggle = document.getElementById('ai-auto-label-toggle');
  if (labelToggle) {
      labelToggle.onchange = async (e) => {
          state.autoLabelingEnabled = e.target.checked;
          const { showToast } = await import('./ui.js');
          const { updateLabelMonitor } = await import('./worker_bridge.js');

          showToast(`AI 자동 라벨링: ${state.autoLabelingEnabled ? 'ON' : 'OFF'}`, 'info');
          updateLabelMonitor(
              `AI Engine ${state.autoLabelingEnabled ? 'Activated' : 'Paused'}`, 
              null, 
              null, 
              'sys-' + Date.now(), 
              'SYSTEM'
          );
          
          if (state.autoLabelingEnabled) {
              const { autoHealingAudit } = await import('./ai.js');
              autoHealingAudit();
          }
      };
  }

  const closeMonitor = document.getElementById('close-monitor');
  if (closeMonitor) {
      closeMonitor.onclick = () => {
          document.getElementById('ai-monitor-panel').classList.remove('active');
      };
  }

  const closeSheet = document.getElementById('close-sheet');
  if (closeSheet) {
      closeSheet.onclick = () => {
          document.getElementById('detail-sheet').classList.remove('active');
      };
  }

  const sideTrigger = document.getElementById('side-hover-trigger');
  if (sideTrigger) {
      sideTrigger.onclick = async () => {
          const { initSocket } = await import('./ai.js');
          showToast("서버 수동 재연동 시도 중...", "info");
          initSocket();
      };
  }
}

export function resetAllInteractions() {
  if (state.map) {
    state.isSelecting = false;
    state.map.dragging.enable();
  }
  const box = document.getElementById('selection-box');
  if (box) box.style.display = 'none';
}
