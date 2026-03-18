import { state, eventStore, saveToDB } from './state.js';
import { showToast } from './ui.js';
import { addMarkerToMap, updateMarkerUI } from './map.js';

/**
 * 🤖 AI & Sync Bridge Layer
 */

export function initSocket() {
  if (state.socket) return;
  try {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.hostname}:9091`);
    state.socket = ws;

    ws.onopen = async () => {
      console.log("✅ AI/Sync Bridge Connected");
      state.isServerConnected = true;
      showToast("로컬 서버 연동 성공", "success");
      
      const { updateLabelMonitor } = await import('./worker_bridge.js');
      updateLabelMonitor("Backend Server Connected", null, "Port: 9005", 'sys-conn', 'SYSTEM');

      ws.send(JSON.stringify({ type: "KNOWLEDGE_REQUEST" }));
      
      // 🚀 Batch Sync: Prevent flooding the socket when local database is large
      if (eventStore.length > 0) {
          const CHUNK_SIZE = 100;
          let delay = 0;
          for (let i = 0; i < eventStore.length; i += CHUNK_SIZE) {
              const chunk = eventStore.slice(i, i + CHUNK_SIZE);
              setTimeout(() => {
                  chunk.forEach(e => syncPacketToServer(e));
              }, delay);
              delay += 500; // 0.5s intervals per 100 items
          }
      }
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "AI_STREAM_CHUNK") {
          handleAiStream(msg.chunk, msg.requestId);
      } else if (msg.type === "KNOWLEDGE_RESULT") {
          integrateServerKnowledge(msg.data, msg.status);
      } else if (msg.type === "KNOWLEDGE_PROGRESS") {
          updateProgressBar(msg.current, msg.total, msg.status);
      } else if (msg.type === "KNOWLEDGE_CLEAR_ACK") {
          showToast(`${msg.region} 서버 캐시 정리 완료`, 'info');
      } else if (msg.type === "KNOWLEDGE_PRUNE_ACK") {
          showToast(`서버 최적화 완료 (${msg.total}건)`, 'success');
          setTimeout(() => location.reload(), 1500);
      } else if (msg.type === "SYNC_ACK") {
          console.log("Sync Confirmed:", msg.id);
      } else if (msg.type === "SERVER_LOG") {
          import('./worker_bridge.js').then(m => {
              m.updateLabelMonitor(msg.title, msg.region, msg.logType, `srv-${Date.now()}`, msg.logType);
          });
      }
    };

    ws.onclose = async () => {
        console.warn("🔌 AI Socket Closed. Retrying in 3s...");
        state.socket = null;
        state.isServerConnected = false;
        
        const { updateLabelMonitor } = await import('./worker_bridge.js');
        updateLabelMonitor("Backend Server Disconnected", null, "Retrying in 3s...", 'sys-disc', 'SYSTEM');
        
        setTimeout(initSocket, 3000);
    };

    ws.onerror = (err) => {
        console.error("Socket Error:", err);
        ws.close();
    };

  } catch (err) {
    console.error("Socket Init Error:", err);
    setTimeout(initSocket, 3000);
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

const streamStates = {}; // 🚀 requestId별 스트림 상태 관리

function handleAiStream(chunk, requestId) {
    const chatBody = document.getElementById('chat-messages');
    if (!chatBody) return;

    if (!streamStates[requestId]) {
        streamStates[requestId] = { isThinking: true, fullText: "" };
    }

    const state = streamStates[requestId];
    state.fullText += chunk;

    // 🚀 [THINKING STATE UI]
    let statusLabel = document.getElementById(`ai-status-${requestId}`);
    if (!statusLabel && state.isThinking) {
        statusLabel = document.createElement('div');
        statusLabel.id = `ai-status-${requestId}`;
        statusLabel.className = 'ai-status-indicator pulse';
        statusLabel.innerHTML = '<span>🧠</span> 에이전트가 최적의 경로를 고민 중입니다...';
        chatBody.appendChild(statusLabel);
    }

    // Thinking 종료 감지
    if (state.isThinking && state.fullText.includes("</thinking>")) {
        state.isThinking = false;
        if (statusLabel) statusLabel.remove(); // 생각 끝나면 상태바 제거
    }

    if (!state.isThinking) {
        let bubble = document.getElementById(`ai-bubble-${requestId}`);
        if (!bubble) {
            bubble = document.createElement('div');
            bubble.id = `ai-bubble-${requestId}`;
            bubble.className = 'message ai fade-in';
            chatBody.appendChild(bubble);
        }
        
        // <thinking> 이후의 텍스트만 표시
        const actualResponse = state.fullText.split("</thinking>")[1] || "";
        bubble.innerHTML = `
            <img src="/assistant-icon.png" class="ai-avatar-tiny" alt="AI">
            <div class="message-content">${actualResponse}</div>
        `;
    }

    chatBody.scrollTop = chatBody.scrollHeight;
}

/**
 * 🚀 서버 지능형 지식 통합기
 */
async function integrateServerKnowledge(knowledgeList, statusMsg) {
    if (!knowledgeList || knowledgeList.length === 0) return;
    
    const { createEventObject, applyJitter } = await import('./utils.js');
    const { addMarkerToMap } = await import('./map.js');
    const { filterMarkers } = await import('./search.js');

    console.log(`[INTEGRATE] Processing ${knowledgeList.length} items from server. (Current: ${eventStore.length})`);
    
    // 🚀 [CAPACITY CHECK] 브라우저 저장 한계(25000건) 도달 시 수집 중단 (v15.0 확장)
    if (eventStore.length > 25000) {
        console.warn("[INTEGRATE] Global capacity reached (25000). Skipping new ingest.");
        showToast("지식 저장 한계에 도달했습니다. (25000개 제한)", "warning");
        return;
    }

    // 🚀 [O(N) Optimization] Persistent ID lookup set used for O(1) checks
    const regionCounts = eventStore.reduce((acc, e) => {
        acc[e.region] = (acc[e.region] || 0) + 1;
        return acc;
    }, {});

    // 🚀 [EMERGENCY CLEANUP] (0,0) 좌표 데이터 제거 
    for (let i = eventStore.length - 1; i >= 0; i--) {
        if (Math.abs(eventStore[i].lat) < 0.1 || Math.abs(eventStore[i].lng) < 0.1) {
            state.existingIds.delete(String(eventStore[i].id));
            eventStore.splice(i, 1);
        }
    }

    const newMarkers = [];
    let addedCount = 0;
    knowledgeList.forEach(item => {
        if (item.Lat === 0 && item.Lng === 0) return;

        const regionName = (item.Tags && item.Tags.length > 0) ? item.Tags[0] : "Global";
        const regionClean = regionName.replace("@", "");
        
        if ((regionCounts[regionClean] || 0) >= 1000) return;

        const descText = item.Description || "";
        const descHash = descText.length > 0 ? descText.substring(0, 10).replace(/[^a-z0-9]/gi, '') : "node";
        const locId = `${parseFloat(item.Lat).toFixed(4)}${parseFloat(item.Lng).toFixed(4)}`;
        const cleanName = (item.Name || "unknown").replace(/\s+/g, '-').toLowerCase();
        const itemId = `s-db-${cleanName}-${descHash}-${locId}`;
        
        if (state.existingIds.has(itemId)) return;

        const coord = applyJitter(item.Lat, item.Lng);

        const eventData = createEventObject({
            id: itemId,
            title: item.Name,
            summary: item.Description,
            tags: item.Tags || [],
            lat: coord.lat,
            lng: coord.lng,
            region: regionClean
        });

        eventStore.push(eventData);
        state.existingIds.add(itemId);
        regionCounts[regionClean] = (regionCounts[regionClean] || 0) + 1;
        
        // 🚀 Batch Rendering Optimization: skip immediate addition
        const marker = addMarkerToMap(eventData, true);
        newMarkers.push(marker);
        addedCount++;

        import('./worker_bridge.js').then(m => {
            m.updateLabelMonitor(item.Name, regionClean, (item.Tags && item.Tags[1]) || "Knowledge", itemId, 'SYNC');
        });
    });
    
    if (addedCount > 0) {
        state.clusterGroup.addLayers(newMarkers);
        saveToDB(); 
        filterMarkers();
        
        // UI Count Update
        const badge = document.getElementById('total-count-badge');
        if (badge) badge.innerText = eventStore.length;

        if (state.worker) {
            state.worker.postMessage({
                action: 'AI_BATCH_LABEL',
                events: eventStore.slice(-addedCount)
            });
        }
    }

    if (statusMsg) showToast(`${statusMsg} (+${addedCount}개)`, 'success');
}

/**
 * 🕵️ AI 전수 조사 (Audit): 기존 모든 데이터에 대해 @라벨링 재실행
 */
export function auditAllData() {
    if (!state.worker) return showToast("AI 엔진이 준비되지 않았습니다.", "info");
    showToast("모든 데이터 AI 라벨링 재분석 시작...", "info");
    state.worker.postMessage({
        action: 'AI_BATCH_LABEL',
        events: eventStore
    });
}

/**
 * 🏥 AI 셀프 힐링: 라벨이 없는 과거 데이터를 백그라운드에서 조용히 치료
 */
export function autoHealingAudit() {
    if (!state.worker || eventStore.length === 0) return;
    
    // 라벨이 'Global'이거나 @태그가 없는 불완전 데이터 필터링 (최대 500개만 스캔)
    const sickData = [];
    for (let i = 0; i < eventStore.length; i++) {
        const ev = eventStore[i];
        if ((ev.region === "Global" || !ev.tags.some(t => t.startsWith("@"))) && (ev._healAttempt || 0) < 3) {
            sickData.push(ev);
            if (sickData.length >= 500) break; 
        }
    }

    if (sickData.length > 0) {
        console.log(`[SELF-HEAL] Scan completed. Found ${sickData.length} items needing repair.`);
        const chunk = sickData.slice(0, 20); 
        state.worker.postMessage({
            action: 'AI_BATCH_LABEL',
            events: chunk
        });
    }
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
        
        import('./worker_bridge.js').then(m => {
            m.updateLabelMonitor("Global Knowledge Stream Started", null, "API: Wiki/OSM", 'sys-fill', 'SYSTEM');
        });
    } else {
        showToast("서버 연결을 확인해주세요.", "error");
    }
}
/**
 * 🛑 지식 수혈 중단 요청
 */
export function stopKnowledgeFill() {
    if (state.socket && state.socket.readyState === WebSocket.OPEN) {
        state.socket.send(JSON.stringify({ type: "KNOWLEDGE_STOP" }));
        showToast("지식 수혈 중단을 요청했습니다.", "info");
        
        import('./worker_bridge.js').then(m => {
            m.updateLabelMonitor("Knowledge Stream Paused", null, "User Requested", 'sys-stop', 'INFO');
        });
    }
}
/**
 * 🧹 강력 지우개: 특정 지역 데이터 완전 소거 (v9.7)
 */
export function wipeRegion(region) {
    if (state.socket && state.socket.readyState === WebSocket.OPEN) {
        state.socket.send(JSON.stringify({ type: "KNOWLEDGE_CLEAR", region: region }));
    }
    
    // 로컬 메모리 및 DB에서 즉시 제거
    const initialCount = eventStore.length;
    const regionClean = region.replace(/[@#]/, "");
    
    for (let i = eventStore.length - 1; i >= 0; i--) {
        const item = eventStore[i];
        const inRegion = item.region?.includes(regionClean);
        const inTitle = item.title?.includes(regionClean);
        const inTags = item.tags?.some(t => t.includes(regionClean));
        
        if (inRegion || inTitle || inTags) {
            state.existingIds.delete(String(item.id));
            eventStore.splice(i, 1);
        }
    }
    
    if (eventStore.length < initialCount) {
        console.log(`[WIPE] Purged ${initialCount - eventStore.length} items for region: ${region}`);
        saveToDB();
        // 맵 UI 갱신 (지워진 마커 반영을 위해 리렌더링 유도)
        location.reload(); // 가장 확실한 방법 (마커 객체 추적이 복잡하므로)
    } else {
        showToast("삭제할 대상을 찾지 못했습니다.", "info");
    }
}
/**
 * 🔌 AI 브릿지 세션 강제 종료
 */
export function terminateAiBridge() {
    if (state.socket) {
        if (state.socket.readyState === WebSocket.OPEN) {
            state.socket.send(JSON.stringify({ type: "BRIDGE_DISCONNECT", status: "terminating" }));
            state.socket.close(1000, "User closed the application");
        }
        state.socket = null;
        console.log("🔌 AI Socket Bridge Terminated.");
    }
}

/**
 * 🚀 [SYSTEM REBOOT] 서버 대청소 및 재시작 (포트 충돌 등 해결)
 */
export function rebootSystem() {
    showToast("시스템 전체 재부팅 시퀀스 가동...", "warning");
    
    // 1. 서버에 자폭(Self-Terminate) 명령 전송
    if (state.socket && state.socket.readyState === WebSocket.OPEN) {
        state.socket.send(JSON.stringify({ 
            type: "SYSTEM_REBOOT",
            reason: "User requested full diagnostic restart",
            timestamp: Date.now()
        }));
    }

    // 2. 브라우저 세션 정리 및 1.5초 후 페이지 리로드
    setTimeout(() => {
        terminateAiBridge();
        location.reload();
    }, 1500);
}

/**
 * ✂️ 데이터 다이어트: 지역 당 최대 1000건으로 슬림화 (v12.1)
 */
export function pruneData(limitPerRegion = 1000) {
    console.log(`[PRUNE] Execution started. Target: ${limitPerRegion} per region.`);
    
    // 1. 서버에 통보 (서버 캐시도 동기화)
    if (state.socket && state.socket.readyState === WebSocket.OPEN) {
        state.socket.send(JSON.stringify({ type: "KNOWLEDGE_PRUNE_PER_REGION", limit: limitPerRegion }));
    }

    // 2. 로컬 브라우저 데이터(eventStore) 정리
    const regionsMap = {};
    eventStore.forEach(ev => {
        const r = ev.region || "Global";
        if (!regionsMap[r]) regionsMap[r] = [];
        regionsMap[r].push(ev);
    });

    let totalPruned = 0;
    const newEventStore = [];

    Object.keys(regionsMap).forEach(r => {
        const items = regionsMap[r];
        if (items.length > limitPerRegion) {
            totalPruned += (items.length - limitPerRegion);
            newEventStore.push(...items.slice(0, limitPerRegion));
        } else {
            newEventStore.push(...items);
        }
    });

    if (totalPruned > 0) {
        // eventStore 원본을 직접 조작 (참조 유지)
        eventStore.length = 0;
        eventStore.push(...newEventStore);
        
        saveToDB();
        showToast(`정리 완료: 지역별 초과 데이터 ${totalPruned}건을 삭제했습니다.`, "success");
        setTimeout(() => location.reload(), 1000); // 맵 인스턴스 갱신
    } else {
        showToast("정리할 초과 데이터가 없습니다. (모든 지역 1000건 이하)", "info");
    }
}

/**
 * ✍️ AI 타이핑 효과 (UX)
 */
export function typeMessage(text, requestId = Date.now(), quickActions = [], speed = 25) {
    const chatBody = document.getElementById('chat-messages');
    if (!chatBody) return;

    const bubble = document.createElement('div');
    bubble.id = `ai-bubble-${requestId}`;
    bubble.className = 'message ai typing';
    chatBody.appendChild(bubble);
    chatBody.scrollTop = chatBody.scrollHeight;

    let i = 0;
    const interval = setInterval(() => {
        if (i < text.length) {
            bubble.innerText += text.charAt(i);
            i++;
            chatBody.scrollTop = chatBody.scrollHeight;
        } else {
            clearInterval(interval);
            bubble.classList.remove('typing');
            if (quickActions && quickActions.length > 0) {
                renderQuickActions(quickActions, chatBody);
            }
        }
    }, speed);
}

/**
 * 🍟 퀵 액션 칩 렌더링
 */
function renderQuickActions(actions, container) {
    const chipWrapper = document.createElement('div');
    chipWrapper.className = 'quick-actions-wrap fade-in';
    
    actions.forEach(act => {
        const chip = document.createElement('div');
        chip.className = 'action-chip';
        chip.innerText = act;
        chip.onclick = () => {
            const input = document.querySelector('.chat-input');
            if (input) {
                input.value = act;
                // 바로 전송 모방
                const sendBtn = document.getElementById('send-chat');
                if (sendBtn) sendBtn.click();
            }
        };
        chipWrapper.appendChild(chip);
    });

    container.appendChild(chipWrapper);
    container.scrollTop = container.scrollHeight;
}

/**
 * 🚀 지능 강화 (Learning Reinforcement)
 */
export function reinforceBrain(tag, relevance = 0.1) {
    if (!state.learningBrain[tag]) {
        state.learningBrain[tag] = { keywords: [tag.replace(/[@#]/, '')], weight: 1.0 };
    }
    state.learningBrain[tag].weight += relevance;
    localStorage.setItem('ai_learning_brain', JSON.stringify(state.learningBrain));
    
    // 워커에 즉시 동기화
    if (state.worker) {
        state.worker.postMessage({ action: 'SYNC_BRAIN', learningData: state.learningBrain });
    }
}

/**
 * 🪄 [DECK MAGIC] 보관함 데이터를 기반으로 AI 여행 동선 설계
 */
export async function suggestItineraryFromDeck() {
    if (eventStore.length === 0) {
        showToast("설계할 데이터가 없습니다.", "info");
        return;
    }

    const { toggleAiChat } = await import('./ui.js');
    toggleAiChat(true);

    const locations = eventStore.map(e => `${e.title}(${e.region})`).join(', ');
    const text = `보관함에 있는 다음 장소들을 기준으로 최적의 1일 여행 동선을 짜줘: ${locations}`;

    // UI 메시지 추가
    const chatMsgCont = document.getElementById('chat-messages');
    if (chatMsgCont) {
        const myMsg = document.createElement('div');
        myMsg.className = 'message user';
        myMsg.innerHTML = `<span>✨</span> 보관함 기반 자동 경로 설계 요청`;
        chatMsgCont.appendChild(myMsg);
    }

    if (state.socket && state.socket.readyState === WebSocket.OPEN) {
        state.socket.send(JSON.stringify({ 
            type: "AI_CHAT_MESSAGE", 
            text: text,
            requestId: Date.now()
        }));
    }
    
    showToast("AI가 최적 경로를 설계 중입니다...", "success");
}
