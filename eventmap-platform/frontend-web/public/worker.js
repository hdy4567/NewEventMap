import { pipeline, env, dot } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

env.allowLocalModels = false;
env.useBrowserCache = true;

/**
 * 🚀 추억꾼(Keeper) SLM v3.0 - Semantic Reasoning Engine
 * 단순 키워드 매칭을 폐기하고, 의미론적 유사도(Semantic Similarity)를 기반으로 추론합니다.
 */

let extractor = null;
let brainEmbeddings = new Map();

// 1. 방대한 초지능 지식 베이스 (Semantic Prototypes)
const KNOWLEDGE_PROTOTYPES = {
    "@서울": "서울 수도 한국 강남 홍대 성수 수도권 도심 korea seoul",
    "@도쿄": "도쿄 일본 시부야 신주쿠 오사카 긴자 재팬 japan tokyo",
    "@제주": "제주도 바다 섬 여행지 하례 성산 서귀포 jeju",
    "#맛집": "식당 음식 카페 맛있는 배고파 디저트 요리 푸드 맛집탐방",
    "#풍경": "자연 경치 야경 뷰 감성 풍경 사진 명소 산책",
    "#기록": "메모 일기 기록 내용 저장해둔 적어놓은 diary memo",
    "#축제": "파티 공연 사람많은 시끌벅적 행사 festival 이벤트"
};

self.onmessage = async function (e) {
    const { action, text, learningData } = e.data;

    if (action === 'SYNC_BRAIN' && learningData) {
        // 실시간으로 강화된 가중치와 키워드 정보를 지능 엔진에 반영
        for (const [tag, data] of Object.entries(learningData)) {
            if (data.keywords && data.keywords.length > 0) {
                KNOWLEDGE_PROTOTYPES[tag] = data.keywords.join(" ");
            }
        }
        // 임베딩 다시 계산 (선택사항: 성능을 위해 변경된 것만 하는 게 좋지만 여기선 단순하게 처리)
        if (extractor) {
            for (const [tag, prototype] of Object.entries(KNOWLEDGE_PROTOTYPES)) {
                extractor(prototype, { pooling: 'mean', normalize: true }).then(output => {
                    brainEmbeddings.set(tag, output.data);
                });
            }
        }
        return;
    }

    if (action === 'AI_PROCESS' && text) {
        try {
            if (!extractor) {
                self.postMessage({ status: 'loading', message: '온디바이스 초지능 엔진(SLM v3.0) 가동 중...' });
                extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
                
                // 지식 베이스 사전 임베딩 (초기 1회)
                for (const [tag, prototype] of Object.entries(KNOWLEDGE_PROTOTYPES)) {
                    const output = await extractor(prototype, { pooling: 'mean', normalize: true });
                    brainEmbeddings.set(tag, output.data);
                }
            }

            // --- 🚀 시맨틱 추론 엔진 (Semantic Logic) ---
            
            // 1. 사용자 입력문의 의미(Embedding) 추출
            const inputOutput = await extractor(text, { pooling: 'mean', normalize: true });
            const inputVector = inputOutput.data;

            const results = [];

            // 2. 모든 태그와의 의미론적 유사도(Cosine Similarity) 계산
            brainEmbeddings.forEach((vector, tag) => {
                let similarity = cosineSimilarity(inputVector, vector);
                
                // 🚀 WEIGHT REINFORCEMENT: 학습된 가중치 반영
                if (learningData && learningData[tag]) {
                    similarity *= learningData[tag].weight || 1.0;
                }
                
                results.push({ tag, score: similarity });
            });

            // 3. 점수 분석 및 임계값(Threshold) 필터링
            // 유사도가 0.25 이상인 것들 중 가장 연관성 높은 것들 추출
            const inferredTags = results
                .filter(r => r.score > 0.25) 
                .sort((a, b) => b.score - a.score);

            const bestLocation = inferredTags.find(t => t.tag.startsWith("@"));
            const bestActivities = inferredTags.filter(t => t.tag.startsWith("#")).slice(0, 2);

            // AI 생각하는 UX 지연
            await new Promise(r => setTimeout(r, 400));

            self.postMessage({ 
                success: true, 
                action: 'AI_RESULT',
                tags: [...new Set([bestLocation?.tag, ...bestActivities.map(a => a.tag)])].filter(t => t),
                location: bestLocation?.tag || "",
                inference: inferredTags.slice(0, 3), // 어떤 근거로 찾았는지 데이터 보고
                matchedKeywords: inferredTags.filter(t => t.score > 0.6) // 학습을 위한 확신 지표 전송
            });
        } catch (err) {
            self.postMessage({ success: false, error: err.message });
        }
    }
};

/**
 * 코사인 유사도 계산기
 */
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
    }
    return dotProduct; // normalize: true 상태이므로 내적값이 곧 코사인 유사도
}

function extractTags(name) {
    const tags = name.match(/@(\w+)|#(\w+)/g);
    return tags ? tags.map(t => t) : [];
}
