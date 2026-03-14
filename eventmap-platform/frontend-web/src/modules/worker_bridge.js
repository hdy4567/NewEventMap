import { state, saveToDB, mockEvents } from './state.js';
import { showToast } from './ui.js';

export function initWorker() {
    state.worker = new Worker('/worker.js', { type: 'module' });
    
    // 🧠 AI Learning Brain Sync
    state.worker.postMessage({ 
        action: 'SYNC_BRAIN', 
        learningData: state.learningBrain 
    });

    state.worker.onmessage = (e) => {
        const { type, results, learningUpdate } = e.data;
        if (type === 'AI_RESULT') {
            console.log("Worker AI Analysis:", results);
            if (learningUpdate) {
                state.learningBrain = learningUpdate;
                localStorage.setItem('ai_learning_brain', JSON.stringify(state.learningBrain));
            }
        }
    };
}
