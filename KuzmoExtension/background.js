/**
 * 🛰️ Kuzmo AI Bridge: Background Service Worker
 * Acts as the "Cloud Storage" between the Kuzmo App and AI platforms.
 */

let lastSelection = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "SYNC_KUZMO_DATA") {
        console.log("📦 [BACKGROUND] Syncing Data from App...", request.data.length, "items");
        lastSelection = request.data;
        sendResponse({ status: "ok" });
    }
    
    if (request.type === "GET_KUZMO_DATA") {
        console.log("📤 [BACKGROUND] Providing Data to AI Platform...");
        sendResponse({ status: "ok", data: lastSelection });
    }
    return true; // Keep channel open for async
});
