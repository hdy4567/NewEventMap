/**
 * 🛰️ Kuzmo AI Bridge: Bi-Modal Content Script (v2025.3.18.20000)
 * Logic A: On Kuzmo App -> Catch events and sync to Background.
 * Logic B: On AI Platforms -> Fetch from Background and Inject.
 */

console.log('💎 Kuzmo AI Bridge Active.');

// --- A. Kuzmo App Logic: Catch and Send to Background ---
window.addEventListener('KuzmoSync', (e) => {
    console.log("📤 [SYNC-IN] Data received from App, sending to Background...", e.detail.length, "items");
    chrome.runtime.sendMessage({ type: "SYNC_KUZMO_DATA", data: e.detail });
});

// --- B. AI Platform Logic: Multi-Protocol Handlers ---

// ✨ [NUCLEAR-ERASER] Kill [KUZMO_SYNC] text as soon as it touches the DOM
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 3 && node.textContent.includes('[KUZMO_SYNC]')) {
                node.textContent = ""; // Delete immediately
            } else if (node.nodeType === 1) {
                if (node.innerText?.includes('[KUZMO_SYNC]')) node.innerText = "";
                if (node.value?.includes('[KUZMO_SYNC]')) node.value = "";
            }
        });
    });
});
observer.observe(document.body, { childList: true, subtree: true });

// 1. Paste Handler (Capture Phase Monopoly)
document.addEventListener('paste', (e) => {
    const data = e.clipboardData;
    const text = data.getData('text/plain');

    if (text && text.includes('[KUZMO_SYNC]')) {
        if (DEBUG_MODE) console.log('🛑 [PASSPORT] Kuzmo Sync detected. Blocking leakage...');
        e.preventDefault();
        e.stopImmediatePropagation(); 
        
        // 🔥 [FORCE-CLEAN] Periodic scrubbing for 1.5 seconds
        let scrubCount = 0;
        const scrubInterval = setInterval(() => {
            const selectors = ['.wysiwyg-textarea', '[role="textbox"]', '[contenteditable="true"]', 'textarea'];
            selectors.forEach(s => {
                const el = document.querySelector(s);
                if (el) {
                    if (el.innerText?.includes('[KUZMO_SYNC]')) el.innerText = "";
                    if (el.value?.includes('[KUZMO_SYNC]')) el.value = "";
                }
            });
            if (++scrubCount > 30) clearInterval(scrubInterval); // 30 * 50ms = 1.5s
        }, 50);

        handleKuzmoSync(e.target);
    }
}, true);

// 2. Drag & Drop Handlers
['dragenter', 'dragover'].forEach(name => {
    document.addEventListener(name, (e) => {
        if (e.dataTransfer.types.includes('application/kuzmo-file')) {
             e.preventDefault(); 
             e.dataTransfer.dropEffect = 'copy';
             // Force Gemini overlay
             if (!e.dataTransfer.types.includes('Files')) {
                 const overlayEvent = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() });
                 overlayEvent.dataTransfer.items.add(new File([], 'kuzmo_sync_marker.md'));
                 e.target.dispatchEvent(overlayEvent);
             }
        }
    }, true);
});

document.addEventListener('drop', (e) => {
    const appData = e.dataTransfer.getData('application/kuzmo-file');
    const dragMarker = e.dataTransfer.getData('text/plain');

    if (appData || (dragMarker && dragMarker.includes('[KUZMO]'))) {
        e.preventDefault();
        e.stopPropagation();
        handleKuzmoSync(e.target, appData ? JSON.parse(appData) : null);
    }
}, true);

const DEBUG_MODE = true;

async function handleKuzmoSync(target, directItems = null) {
    if (DEBUG_MODE) console.group('🦷 [SURGERY] Kuzmo Sync Initiation');
    try {
        let items = directItems;
        if (!items) {
             const response = await chrome.runtime.sendMessage({ type: "GET_KUZMO_DATA" });
             items = response.data;
        }

        if (items && items.length > 0) {
            if (DEBUG_MODE) console.log(`🧠 Found ${items.length} items in Background Bridge.`);
            const files = items.map(item => {
                const blob = new Blob([item.content || item.summary], { type: 'text/markdown' });
                const fileName = item.fileName || `${(item.title || 'Untitled').replace(/[\/\\?%*:|"<>\s]/g, '_')}.md`;
                return new File([blob], fileName, { type: 'text/markdown' });
            });
            
            // 🔥 [SURGERY] Aggressive Retry Injection
            let retries = 0;
            const tryInject = () => {
                const success = injectFilesIntoAI(files, target);
                if (!success && retries < 5) {
                    retries++;
                    if (DEBUG_MODE) console.warn(`⚠️ Injection failed. Retrying... (${retries}/5)`);
                    setTimeout(tryInject, 400);
                } else if (success) {
                    if (DEBUG_MODE) console.groupEnd();
                }
            };
            tryInject();
        } else {
            showToast("❌ No items found in clipboard bridge.", "error");
            if (DEBUG_MODE) console.groupEnd();
        }
    } catch (err) { 
        console.error('Kuzmo Sync Error:', err); 
        if (DEBUG_MODE) console.groupEnd();
    }
}

function injectFilesIntoAI(files, target) {
    try {
        // 🚀 [GEMINI-FORCE-TARGET] Aggressive Selector Scan
        const selectors = [
            'input[type="file"]', 
            'button[aria-label*="Add files"]', 
            'button[aria-label*="Attach"]',
            '.wysiwyg-textarea',
            '[role="textbox"]',
            '[contenteditable="true"]',
            '.sc_prompt_input' // Gemini New/Experimental
        ];
        
        const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
        const promptInput = selectors.map(s => document.querySelector(s)).find(el => el && el.offsetParent !== null);

        if (DEBUG_MODE) console.log('🎯 Targeting Prompt:', promptInput);
        if (DEBUG_MODE) console.log('📂 Found File Inputs:', fileInputs.length);

        if (fileInputs.length > 0) {
            const dataTransfer = new DataTransfer();
            files.forEach(f => dataTransfer.items.add(f));

            fileInputs.forEach(input => {
                input.files = dataTransfer.files;
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });

            // ✨ [PROMPT-CLEANUP] Standardize prompt state
            if (promptInput) {
                if (promptInput.innerText?.includes('[KUZMO_SYNC]')) promptInput.innerText = "";
                if (promptInput.value?.includes('[KUZMO_SYNC]')) promptInput.value = "";
                promptInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            showToast(`✅ ${files.length} Files Force-Injected!`, "success");
            return true;
        } else {
             // Force UI state generation
             const uploadBtn = document.querySelector('button[aria-label*="Add files"], button[aria-label*="Attach"]');
             if (uploadBtn) {
                 if (DEBUG_MODE) console.log('⚡ Triggering Upload Button Click...');
                 uploadBtn.click();
             }
             return false;
        }
    } catch (err) {
        if (DEBUG_MODE) console.error('❌ Injection Algorithm Critical Failure:', err);
        return false;
    }
}

function showToast(msg, type = "success") {
    const toast = document.createElement('div');
    const color = type === "error" ? "#ff4444" : (type === "warning" ? "#ffbb33" : "#00bcd4");
    toast.style = `position: fixed; top: 20px; right: 20px; background: ${color}; color: white; padding: 12px 24px; border-radius: 8px; font-weight: bold; z-index: 100000; box-shadow: 0 4px 15px rgba(0,0,0,0.3); animation: slideIn 0.3s ease-out;`;
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 4000);
}
