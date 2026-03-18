import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

/**
 * 🧠 추억꾼(Keeper) SLM v11.0 - Neural RAG Orchestrator (Ultimate)
 * 하드코딩된 Regex 의도 파악을 폐기하고, 벡터 공간에서의 '의미 근접성'으로 의도를 추론합니다.
 */

const MODEL_NAME = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
let extractor = null;
let eventEmbeddings = new Map();
let intentVectors = new Map();
let coreKnowledge = new Map();
const SYSTEM_PROMPTS = {
    PLANNING: "📍 {region} 맞춤 일정을 제안합니다.\n추천 경로: {spots}\n{vibe}에 딱 맞는 {count}곳을 선정했습니다.\n\n{reasoning}",
    GREETING: "안녕하세요! 쿠즈모(Kuzmo) 여행 가이드입니다.\n{vibe}이네요. 어떤 여행 계획을 도와드릴까요?",
    EXPLORE: "🔍 {region} 주변에서 가장 추천하는 곳은 '{bestSpot}'입니다.\n{vibe}과 잘 어울리는 장소들을 더 찾아드릴까요?",
    FALLBACK: "죄송해요. {region} 주변에서 관련 메모를 찾지 못했습니다.\n{vibe}에도 계속 탐색 중이니, 📡 실시간 수혈 버튼을 눌러보세요!"
};
const VIBES = {
    morning: "상쾌한 아침",
    afternoon: "활기찬 오후",
    evening: "여유로운 저녁",
    night: "조용한 밤"
};

self.onmessage = async function (e) {
    const { action, text, learningData, events, history, localTime } = e.data;

    if (action === 'AI_SMART_PROCESS' && text) {
        try {
            if (!extractor) {
                self.postMessage({ status: 'loading', message: `Neural RAG Engine v12.0 (${MODEL_NAME}) 최적화 대기 중...` });
                extractor = await pipeline('feature-extraction', MODEL_NAME);
                await initCoreKnowledge();
                await initIntentVectors();
            }

            // 1. [Retrieval]
            const queryVec = (await extractor(text, { pooling: 'mean', normalize: true })).data;
            
            // 임베딩 캐시
            if (events && events.length > 0) {
                // Self-healing for unlabeled items (v11.1)
                const sickData = events.filter(ev => !eventEmbeddings.has(ev.id));
                if (sickData.length > 0) {
                    console.log(`[SELF-HEAL] Found ${sickData.length} unlabeled items. Healing in background (Capped at 500)...`);
                    // 워커 부하 방지를 위해 최대 500개까지만 스케줄링
                    const totalCap = sickData.slice(0, 500);
                    for (let i = 0; i < totalCap.length; i += 15) {
                        const chunk = totalCap.slice(i, i + 15);
                        await Promise.all(chunk.map(async ev => {
                            const content = `${ev.title} ${ev.summary || ''} ${ev.tags.join(' ')}`;
                            const out = await extractor(content, { pooling: 'mean', normalize: true });
                            eventEmbeddings.set(ev.id, out.data);
                        }));
                    }
                }
            }

            const retrieved = [];
            if (events) {
                events.forEach(ev => {
                    const vec = eventEmbeddings.get(ev.id);
                    if (vec) {
                        let sim = cosineSimilarity(queryVec, vec);
                        // Keyword Boost
                        if (text.toLowerCase().includes(ev.title.toLowerCase())) sim += 0.3;
                        if (ev.tags.some(t => text.includes(t.replace(/[@#]/,'')))) sim += 0.15;
                        retrieved.push({ ...ev, sim });
                    }
                });
            }

            const topMatches = retrieved.sort((a,b) => b.sim - a.sim).filter(r => r.sim > 0.28);
            
            // 2. [Augmentation]
            const hour = parseInt(localTime) || 12;
            const vibe = getVibe(hour);
            const intent = await matchIntent(queryVec, text);
            const matches = await matchCoreTag(queryVec, text);
            const region = matches.region ? matches.region.replace('@', '') : (topMatches[0]?.region || history[history.length-1]?.location?.replace('@','') || "주변");

            // 3. [Generation]
            let response = "";
            let quickActions = [];
            
            if (intent === 'PLANNING' && topMatches.length > 0) {
                const uniqueSpots = [...new Set(topMatches.map(m => m.title))].slice(0, 3);
                response = SYSTEM_PROMPTS.PLANNING
                    .replace("{region}", region)
                    .replace("{count}", uniqueSpots.length)
                    .replace("{spots}", uniqueSpots.join(' → '))
                    .replace("{vibe}", vibe)
                    .replace("{reasoning}", `(분석: ${MODEL_NAME} 신경망이 추출한 고밀도 경로)`);
                quickActions = ["최적 동선 보기", "경로 필터링", "일정 저장"];
            } else if (intent === 'GREETING') {
                response = SYSTEM_PROMPTS.GREETING.replace("{vibe}", vibe);
                quickActions = ["최근 기록 보기", "명소 추천해줘", "현재 위치 핀 찾기"];
            } else if (topMatches.length > 0) {
                response = SYSTEM_PROMPTS.EXPLORE
                    .replace("{region}", region)
                    .replace("{bestSpot}", topMatches[0].title)
                    .replace("{vibe}", vibe);
                quickActions = ["상세 정보 열기", "이 주변 맛집", "비슷한 메모 더보기"];
            } else {
                response = SYSTEM_PROMPTS.FALLBACK.replace("{region}", region).replace("{vibe}", vibe);
                quickActions = ["📡 지식 실시간 수혈", "다른 지역 탐색"];
            }

            self.postMessage({
                success: true,
                action: 'AI_SMART_RESULT',
                response,
                location: `@${region}`,
                contextId: topMatches[0]?.id || null,
                coordinates: topMatches[0] ? [topMatches[0].lat, topMatches[0].lng] : null,
                quickActions
            });

        } catch (err) {
            console.error("RAG Worker Error:", err);
            self.postMessage({ success: false, error: err.message });
        }
    }

    if (action === 'AI_BATCH_LABEL' && events) {
        try {
            if (!extractor) {
                extractor = await pipeline('feature-extraction', MODEL_NAME);
                await initCoreKnowledge();
            }

            const labeledResults = [];
            for (const ev of events) {
                try {
                    const content = `${ev.title} ${ev.summary || ''} ${ev.tags?.join(' ') || ''}`;
                    const out = await extractor(content, { pooling: 'mean', normalize: true });
                    const vec = out.data;

                    const matches = await matchCoreTag(vec, content);
                    labeledResults.push({
                        id: ev.id,
                        suggestedRegion: matches.region,
                        suggestedCategory: matches.category
                    });
                } catch (itemErr) {
                    labeledResults.push({ id: ev.id, suggestedRegion: null, suggestedCategory: null });
                }
            }

            self.postMessage({ action: 'AI_LABEL_RESULT', results: labeledResults });
        } catch (err) {
            console.error("Batch Label Error:", err);
        }
    }
};

async function initCoreKnowledge() {
    const regions = {
        "@서울": "서울 수도 한국 대한민국 강남 홍대 종로 성수 seoul korea",
        "@도쿄": "도쿄 일본 시부야 신주쿠 긴자 하라주쿠 tokyo japan",
        "@제주": "제주도 섬 바다 하례 성산 서귀포 애월 jeju island resort",
        "@오사카": "오사카 일본 도톤보리 난바 신세카이 osaka japan",
        "@부산": "부산 해운대 광안리 항구 도시 busan korea",
        "@후쿠오카": "후쿠오카 큐슈 라멘 fukuoka japan",
        "@홋카이도": "홋카이도 삿포로 눈 축제 hokkaido sapporo",
        "@인천": "인천 공항 바다 송도 incheon korea",
        "@강원": "강원도 산 바다 속초 강릉 gangwon korea",
        "@경주": "경주 신라 역사 유적지 불국사 gyeongju korea"
    };
    const categories = {
        "#맛집": "식당 카페 맛있는 음식 요리 베이커리 푸드 디저트 구르메 미식 food cafe restaurant gourmet",
        "#숙소": "호텔 숙소 스테이 민박 여관 숙박 리조트 게스트하우스 펜션 hotel stay hostel inn resort",
        "#일정": "계획 코스 동선 투어 가이드 이동 경로 가이드 투어 plan itinerary course",
        "#풍경": "자연 경치 야경 뷰 감성 명소 포토존 공원 산 landscape view scenery",
        "#기록": "메모 일기 기록 내용 생각 저장 노트 리포트 record diary memo note"
    };

    for (const [tag, text] of Object.entries(regions)) {
        const out = await extractor(text, { pooling: 'mean', normalize: true });
        coreKnowledge.set(tag, out.data);
    }
    for (const [tag, text] of Object.entries(categories)) {
        const out = await extractor(text, { pooling: 'mean', normalize: true });
        coreKnowledge.set(tag, out.data);
    }
}

async function initIntentVectors() {
    const intents = {
        PLANNING: "일정 짜기 계획 코스 동선 투어 여행 루트 짜줘 plan itinerary roadmap",
        GREETING: "안녕 하이 방가워 뭐해 hello hi greeting",
        EXPLORE: "주변 탐색 찾아줘 맛집 알려줘 구경 discover look around see"
    };
    for (const [key, text] of Object.entries(intents)) {
        const out = await extractor(text, { pooling: 'mean', normalize: true });
        intentVectors.set(key, out.data);
    }
}

async function matchCoreTag(vec, text) {
    let bestRegion = null; let maxRegionSim = -1;
    let bestCategory = null; let maxCategorySim = -1;

    coreKnowledge.forEach((v, tag) => {
        let sim = cosineSimilarity(vec, v);
        
        // 🚀 [KEYWORD REINFORCEMENT] (v12.2)
        // 벡터 공간의 모호함을 텍스트 매칭으로 보정합니다.
        const textLower = (text || "").toLowerCase();
        if (tag === "#숙소" && (textLower.includes("호텔") || textLower.includes("hotel") || textLower.includes("stay") || textLower.includes("resort"))) sim += 0.25;
        if (tag === "#맛집" && (textLower.includes("맛집") || textLower.includes("카페") || textLower.includes("cafe") || textLower.includes("식당") || textLower.includes("food"))) sim += 0.15;
        if (tag === "@제주" && (textLower.includes("제주") || textLower.includes("jeju"))) sim += 0.3;

        if (tag.startsWith("@")) {
            if (sim > maxRegionSim) { maxRegionSim = sim; bestRegion = tag; }
        } else {
            if (sim > maxCategorySim) { maxCategorySim = sim; bestCategory = tag; }
        }
    });

    return {
        region: maxRegionSim > 0.38 ? bestRegion : null,
        category: maxCategorySim > 0.38 ? bestCategory : null
    };
}

async function matchIntent(queryVec, text) {
    let best = 'EXPLORE';
    let maxScan = -1;

    intentVectors.forEach((v, key) => {
        const sim = cosineSimilarity(queryVec, v);
        if (sim > maxScan) { maxScan = sim; best = key; }
    });

    // Regex Fallback (하이브리드)
    if (/일정|계획|코스|동선|루트|plan|itinerary/.test(text.toLowerCase())) return 'PLANNING';
    if (/안녕|반가|하이|hello|hi/.test(text.toLowerCase())) return 'GREETING';

    return maxScan > 0.4 ? best : 'EXPLORE';
}

function getVibe(hour) {
    if (hour >= 5 && hour < 12) return VIBES.morning;
    if (hour >= 12 && hour < 18) return VIBES.afternoon;
    if (hour >= 18 && hour < 22) return VIBES.evening;
    return VIBES.night;
}

function cosineSimilarity(A, B) {
    let dot = 0;
    for (let i = 0; i < A.length; i++) dot += A[i] * B[i];
    return dot;
}
