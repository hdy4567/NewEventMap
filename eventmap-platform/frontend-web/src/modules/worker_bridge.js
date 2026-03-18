import { state, saveToDB, eventStore } from './state.js';
import { showToast } from './ui.js';

export function initWorker() {
    state.worker = new Worker(new URL('./ai_neural_worker.js', import.meta.url), { type: 'module' });
    
    state.worker.postMessage({ 
        action: 'SYNC_BRAIN', 
        learningData: state.learningBrain 
    });

    updateLabelMonitor("AI Engine v14.0 Standby", null, null, 'init', 'SYSTEM');

    state.worker.onmessage = async (e) => {
        const { action, response, tags, location, contextId, message, status } = e.data;
        
        if (status === 'loading') {
            console.log("AI Engine Status:", message);
            return;
        }

        if (action === 'AI_SMART_RESULT') {
            const { typeMessage } = await import('./ai.js');
            const { filterByTag } = await import('./navigation.js');
            const { showDetailSheet } = await import('./ui.js');
            
            typeMessage(response, Date.now(), e.data.quickActions);

            // 🧠 단기 기억 업데이트
            state.conversationHistory.push({
                tags,
                location,
                contextId,
                timestamp: Date.now()
            });
            if (state.conversationHistory.length > 5) state.conversationHistory.shift();

            // 지능형 맵 연동
            if (location) {
                filterByTag(location);
            }

            if (e.data.coordinates) {
                state.map.flyTo(e.data.coordinates, 14);
            }

            if (contextId) {
                const event = eventStore.find(ev => ev.id === contextId);
                if (event) {
                    setTimeout(() => showDetailSheet(event), 1200);
                }
            }
        }

        if (action === 'AI_LABEL_RESULT' && e.data.results) {
            const report = [];
            e.data.results.forEach(res => {
                const ev = eventStore.find(it => String(it.id) === String(res.id));
                if (ev) {
                    // 🚀 [TOGGLE CHECK] On/Off 에 따라 적용 여부 결정
                    if (!state.autoLabelingEnabled && !e.data.isAudit) return;

                    const oldRegion = ev.region;
                    const oldTags = [...ev.tags];

                    // 1. 지역 라벨링 처리 (@)
                    if (res.suggestedRegion) {
                        ev.tags = ev.tags.filter(t => !t.startsWith("@"));
                        ev.tags.push(res.suggestedRegion);
                        ev.region = res.suggestedRegion.replace("@", "");
                    }

                    // 2. 카테고리 라벨링 처리 (#)
                    if (res.suggestedCategory) {
                        if (!ev.tags.includes(res.suggestedCategory)) {
                            ev.tags.push(res.suggestedCategory);
                        }
                    }

                    // 🏥 치료 및 분석 상태 기록
                    ev._healAttempt = (ev._healAttempt || 0) + 1;
                    
                    if (oldRegion !== ev.region || ev.tags.length !== oldTags.length) {
                        report.push(`📍 [${ev.title}] : ${oldRegion} -> ${ev.region} / Tags: [${ev.tags.join(', ')}]`);
                        updateLabelMonitor(ev.title, ev.region, res.suggestedCategory, ev.id, 'LABEL');
                    }
                }
            });
            saveToDB();
            import('./search.js').then(s => s.filterMarkers());
            
            const count = e.data.results.length;
            const message = e.data.isAudit ? `전수 조사 완료: ${count}개 라벨 최적화` : `AI 실시간 분석 완료: ${count}개 지역 라벨링 적용`;
            
            if (report.length > 0) {
                console.group(`🧠 AI Labeling Report (${count} items)`);
                report.forEach(line => console.log(line));
                console.groupEnd();
            }
            
            // 전수 조사가 아닐 때만 (백그라운드 힐링일 때만) 토스트 생략 가능하지만, 
            // 사용자 확인을 위해 유지 혹은 로그로 대체
            if (!e.data.isAudit) {
                console.log(`[AI LABEL] ${message}`);
            } else {
                showToast(message, "success");
            }

            // 🏥 다음 힐링 배치가 있는지 확인 (Chain Reaction)
            if (!e.data.isAudit && state.autoLabelingEnabled) {
                import('./ai.js').then(m => m.autoHealingAudit());
            }
        }
    };
}


// 🛰️ UI Proxies to ui.js
export function updateLabelMonitor(...args) {
    import('./ui.js').then(m => m.updateLabelMonitor(...args));
}

export function filterMonitor(...args) {
    import('./ui.js').then(m => m.filterMonitor(...args));
}

/**
 * 🧠 온디바이스 AI 워커 종료
 */
export function terminateWorker() {
    if (state.worker) {
        state.worker.terminate();
        state.worker = null;
        console.log("🧠 On-device AI Worker Terminated.");
    }
}
