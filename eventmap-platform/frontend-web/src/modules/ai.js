import { state, mockEvents, saveToDB } from './state.js';
import { showToast } from './ui.js';
import { addMarkerToMap, updateMarkerUI } from './map.js';

/**
 * 🤖 AI & Sync Bridge Layer
 */

export function initSocket() {
  if (state.socket) return;
  try {
    const ws = new WebSocket(`ws://127.0.0.1:9091`);
    state.socket = ws;

    ws.onopen = () => {
      console.log("✅ AI/Sync Bridge Connected");
      showToast("로컬 서버 연동 성공", "success");
      
      // 🚀 실시간 지식 수혈 요청
      ws.send(JSON.stringify({ type: "KNOWLEDGE_REQUEST" }));

      // Bulk Sync initialization
      if (mockEvents.length > 0) {
          console.log(`[SYNC] Bulk syncing ${mockEvents.length} items...`);
          mockEvents.forEach(e => syncPacketToServer(e));
      }
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "AI_STREAM_CHUNK") {
          handleAiStream(msg.chunk, msg.requestId);
      } else if (msg.type === "KNOWLEDGE_RESULT") {
          console.log(`[SOCKET] Received KNOWLEDGE_RESULT for region. Count: ${msg.data?.length}`);
          integrateServerKnowledge(msg.data, msg.status);
      } else if (msg.type === "KNOWLEDGE_PROGRESS") {
          updateProgressBar(msg.current, msg.total, msg.status);
      } else if (msg.type === "SYNC_ACK") {
          console.log("Sync Confirmed:", msg.id);
      }
    };
  } catch (err) {
    console.error("Socket Error:", err);
  }
}

export function syncPacketToServer(packet) {
  if (state.socket && state.socket.readyState === WebSocket.OPEN) {
    state.socket.send(JSON.stringify({
      type: "SYNC_PACKET",
      data: {
        id: packet.id,
        title: packet.title,
        content: packet.summary || packet.title,
        tags: packet.tags
      }
    }));
  }
}

function handleAiStream(chunk, requestId) {
    const chatBody = document.getElementById('chat-body');
    if (!chatBody) return;

    let bubble = document.getElementById(`ai-bubble-${requestId}`);
    if (!bubble) {
        bubble = document.createElement('div');
        bubble.id = `ai-bubble-${requestId}`;
        bubble.className = 'chat-bubble ai';
        chatBody.appendChild(bubble);
        chatBody.scrollTop = chatBody.scrollHeight;
    }
    
     bubble.innerText += chunk;
    chatBody.scrollTop = chatBody.scrollHeight;
}

/**
 * 🚀 서버 지능형 지식 통합기
 */
function integrateServerKnowledge(knowledgeList, statusMsg) {
    if (!knowledgeList || knowledgeList.length === 0) {
        console.warn("[INTEGRATE] Warning: Received empty knowledge list.");
        return;
    }
    
    console.log(`[INTEGRATE] Processing ${knowledgeList.length} items. Status: ${statusMsg}`);
    
    import('./map.js').then(m => {
        knowledgeList.forEach(item => {
            // 고유 ID 생성 (이름 기반으로 일관성 유지)
            const itemId = `s-db-${item.Name.replace(/\s+/g, '-').toLowerCase()}`;
            
            // 중복 체크 (ID 또는 이름 기준)
            const exists = mockEvents.some(e => e.id === itemId || e.title === item.Name);
            if (exists) return;

            const eventData = {
                id: itemId,
                title: item.Name,
                summary: item.Description,
                tags: item.Tags || [],
                lat: item.Lat,
                lng: item.Lng,
                imageUrl: `https://picsum.photos/seed/${encodeURIComponent(item.Name)}/400/300`,
                region: item.Tags[0] || "Global",
                country: (item.Tags.includes("일본") || item.Tags.includes("Japan")) ? "Japan" : "Korea"
            };

            mockEvents.push(eventData);
            m.addMarkerToMap(eventData);
        });
        
        saveToDB(); // 🚀 영구 저장 (새로고침 시 증발 방지)
        if (statusMsg) showToast(statusMsg, 'success');
        import('./search.js').then(s => s.filterMarkers()); // 필터링 갱신
    });
}

function updateProgressBar(current, total, status) {
    let bar = document.getElementById('knowledge-progress-bar');
    let container = document.getElementById('knowledge-progress-container');
    if (!container) return;

    container.style.display = 'block';
    const percent = Math.round((current / total) * 100);
    if (bar) bar.style.width = `${percent}%`;
    
    const label = document.getElementById('knowledge-progress-label');
    if (label) label.innerText = `${status} (${percent}%)`;

    if (current >= total) {
        setTimeout(() => { container.style.display = 'none'; }, 2000);
    }
}

/**
 * 🚀 서버에 지식 대량 수혈 요청
 */
export function requestKnowledgeFill() {
    if (state.socket && state.socket.readyState === WebSocket.OPEN) {
        showToast("지식 실시간 수혈 시작 (Wikipedia/OSM API)", "info");
        state.socket.send(JSON.stringify({ type: "KNOWLEDGE_FILL" }));
    } else {
        showToast("서버 연결을 확인해주세요.", "error");
    }
}
