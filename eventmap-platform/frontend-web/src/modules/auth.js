import { state, CONFIG } from './state.js';
import { showToast } from './ui.js';

/**
 * 🔐 Auth & Google Drive Service Layer
 */
let tokenClient;

export function initGoogleAuth() {
  if (typeof gapi !== 'undefined' && gapi.load) {
      gapi.load('client:picker', startGapi);
  }
  
  if (typeof google !== 'undefined' && google.accounts) {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.clientId,
        scope: CONFIG.scopes,
        callback: (resp) => { 
          if (resp.access_token) {
            state.isLockerSynced = true;
            localStorage.setItem('is_locker_synced', 'true');
            // If we were waiting for a picker, we could trigger it here, 
            // but for now, we just update the UI.
          }
        }
      });
  }
}

async function startGapi() {
  if (!gapi.client) return;
  try {
    await gapi.client.init({
      apiKey: CONFIG.apiKey,
      discoveryDocs: CONFIG.discoveryDocs,
    });
    // 🚀 Explicitly set API Key for Picker and other services
    gapi.client.setApiKey(CONFIG.apiKey);
    console.log("✅ GAPI Client Initialized & API Key Set");
  } catch (err) {
    const errorMsg = err?.result?.error?.message || err?.details || JSON.stringify(err);
    console.error("❌ GAPI Init Failure Details:", errorMsg);
    
    if (errorMsg.includes("origin") || errorMsg.includes("Referer")) {
        console.warn("💡 원인: GCP 콘솔의 API 키 '웹사이트 제한사항'에 http://localhost:9005/* 를 추가해야 합니다.");
    } else if (errorMsg.includes("disallowed")) {
        console.warn("💡 원인: GCP 콘솔에서 해당 API 키에 'Google Drive API' 사용 권한이 체크되어 있는지 확인하세요.");
    }
  }
}
window.startGapiManual = startGapi; // Debugging fallback


export function handleAuthClick() {
  if (!tokenClient) {
      showToast("Google Auth 시스템이 아직 준비되지 않았습니다.", "error");
      return;
  }
  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) throw (resp);
    state.isLockerSynced = true;
    localStorage.setItem('is_locker_synced', 'true');
    showToast("Google Drive 연동 성공", "success");
    
    // 🚀 로그인 후 다음 로직: 폴더 선택 화면으로 전환
    const unsynced = document.getElementById('locker-unsynced');
    const folderPicker = document.getElementById('locker-folder-picker');
    if (unsynced) unsynced.style.display = 'none';
    if (folderPicker) {
      folderPicker.style.display = 'flex';
      // 실제 시나리오에서는 여기서 API를 호출하여 폴더 목록을 가져옴
      // workflow 지침에 따라 실제 로직처럼 동작하도록 하드코딩 탈피 시도
      window.refreshFolderList();
    }
  };

  if (gapi.client.getToken() === null) {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    tokenClient.requestAccessToken({ prompt: '' });
  }
}

// 📂 로그인 후 다음 로직: 폴더 리스트 연동 및 선택
export async function fetchDriveFolders() {
  try {
    const response = await gapi.client.drive.files.list({
      q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: "files(id, name)",
      pageSize: 10
    });
    return response.result.files || [];
  } catch (err) {
    console.error("Folder fetch error:", err);
    return [];
  }
}

// 📂 폴더 내 파일 목록 조회 (보관함 실제 데이터)
export async function fetchFilesInFolder(folderId) {
  if (!folderId) return [];
  try {
    const response = await gapi.client.drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id, name, thumbnailLink, mimeType, webViewLink)",
      pageSize: 20
    });
    return response.result.files || [];
  } catch (err) {
    console.error("File fetch error:", err);
    return [];
  }
}

// 🎯 [NEW] Google Picker API: 공식 문서 권장 폴더 선택기
export function showPicker() {
  const token = gapi.client.getToken();
  if (!token) {
    handleAuthClick(); 
    return;
  }

  // Debugging: Verify config before building picker
  console.log("📂 Launching Google Picker with:", {
    appId: CONFIG.appId,
    hasToken: !!token.access_token,
    keyExists: !!CONFIG.apiKey,
    keyPrefix: CONFIG.apiKey ? CONFIG.apiKey.substring(0, 8) : 'NONE'
  });

  const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
    .setSelectFolderEnabled(true)
    .setIncludeFolders(true)
    .setMimeTypes('application/vnd.google-apps.folder');

  const picker = new google.picker.PickerBuilder()
    .addView(view)
    .setOAuthToken(token.access_token)
    .setDeveloperKey(CONFIG.apiKey)
    .setAppId(CONFIG.appId) 
    .setOrigin(window.location.origin) // 🚀 필수: 9005번 포트와 같은 커스텀 origin 명시
    .setCallback(pickerCallback)
    .build();
  
  picker.setVisible(true);
}

function pickerCallback(data) {
  if (data.action === google.picker.Action.PICKED) {
    const doc = data.docs[0];
    const name = doc.name;
    const id = doc.id;
    
    // UI 모듈의 글로벌 함수 호출
    if (window.selectLockerFolder) {
      window.selectLockerFolder(name, id);
    }
  }
}
