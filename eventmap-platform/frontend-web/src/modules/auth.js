import { state, CONFIG, eventStore, saveToDB } from './state.js';
import { showToast } from './ui.js';

/**
 * 🔐 Auth & Google Drive Service Layer
 */
let tokenClient;
const syncFingerprints = new Map();
let isSyncing = false;

export async function initGoogleAuth() {
  return new Promise((resolve) => {
    if (typeof gapi !== 'undefined' && gapi.load) {
        gapi.load('client:picker', async () => {
            await startGapi();
            resolve();
        });
    } else {
        resolve(); // Fallback if GAPI not available
    }
    
    if (typeof google !== 'undefined' && google.accounts) {
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: CONFIG.clientId,
          scope: CONFIG.scopes,
          callback: (resp) => { 
            if (resp.access_token) {
              state.isLockerSynced = true;
              localStorage.setItem('is_locker_synced', 'true');
            }
          }
        });
    }
  });
}

/**
 * ☁️ [CLOUD RESTORE] 클라우드 저장소에서 데이터 복구 (v7.0 Incremental Manifest 지원)
 */
export async function loadEventsFromDrive() {
    if (!state.lockerFolderId) return;
    
    try {
        const manifestName = "kuzmo_manifest.v1.json";
        const search = await gapi.client.drive.files.list({
            q: `name = '${manifestName}' and '${state.lockerFolderId}' in parents and trashed = false`,
            fields: "files(id)"
        });

        const manifestId = search.result.files[0]?.id;
        if (!manifestId) {
            console.log("☁️ No cloud manifest found. Falling back to legacy metadata.");
            return legacyRestore();
        }

        const response = await gapi.client.drive.files.get({
            fileId: manifestId,
            alt: 'media'
        });

        const manifest = typeof response.result === 'string' ? JSON.parse(response.result) : response.result;
        console.log("☁️ Manifest loaded:", manifest);

        if (manifest.chunks) {
            let restoredCount = 0;
            for (const [region, fileId] of Object.entries(manifest.chunks)) {
                try {
                    const chunkResp = await gapi.client.drive.files.get({ fileId, alt: 'media' });
                    const chunkData = typeof chunkResp.result === 'string' ? JSON.parse(chunkResp.result) : chunkResp.result;
                    
                    if (Array.isArray(chunkData)) {
                        chunkData.forEach(ev => {
                            if (!eventStore.some(m => m.id === ev.id)) {
                                eventStore.push(ev);
                                restoredCount++;
                            }
                        });
                    }
                } catch (chunkErr) {
                    console.warn(`Failed to load chunk for ${region}:`, chunkErr);
                }
            }
            
            if (restoredCount > 0) {
                saveToDB();
                refreshUI();
                showToast(`Cloud 데이터 ${restoredCount}건 복구 완료`, "success");
            }
        }
    } catch (err) {
        console.error("Cloud Restore Error:", err);
    }
}

async function legacyRestore() {
    const fileName = "kuzmo_metadata.json";
    const search = await gapi.client.drive.files.list({
        q: `name = '${fileName}' and '${state.lockerFolderId}' in parents and trashed = false`,
        fields: "files(id)"
    });
    const fileId = search.result.files[0]?.id;
    if (!fileId) return;
    
    const response = await gapi.client.drive.files.get({ fileId, alt: 'media' });
    const cloudData = typeof response.result === 'string' ? JSON.parse(response.result) : response.result;
    
    if (Array.isArray(cloudData)) {
        cloudData.forEach(ev => {
            if (!eventStore.some(m => m.id === ev.id)) eventStore.push(ev);
        });
        saveToDB();
        refreshUI();
    }
}

function refreshUI() {
    import('./map.js').then(m => {
        eventStore.forEach(e => m.addMarkerToMap(e));
        import('./search.js').then(s => s.filterMarkers());
    });
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
      
      // 🚀 로그인 직후 전체 데이터 복구 시도
      await loadEventsFromDrive();
      
      const unsynced = document.getElementById('locker-unsynced');
    const folderPicker = document.getElementById('locker-folder-picker');
    if (unsynced) unsynced.style.display = 'none';
    if (folderPicker) {
      folderPicker.style.display = 'flex';
      // 실제 시나리오에서는 여기서 API를 호출하여 폴더 목록을 가져옴
      // workflow 지침에 따라 실제 로직처럼 동작하도록 하드코딩 탈피 시도
      const { refreshFolderList } = await import('./ui.js');
      refreshFolderList();
    }
  };

  if (gapi.client.getToken() === null) {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    tokenClient.requestAccessToken({ prompt: '' });
  }
}

// 🚀 [Kuzmo_Archive] 전용 폴더 자동 생성 및 연동
export async function createArchiveFolderAuto() {
  try {
    const folderName = "Kuzmo_Archive";
    
    // 1. 이미 존재하는지 확인
    const search = await gapi.client.drive.files.list({
      q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id, name)"
    });

    let folderId;
    if (search.result.files.length > 0) {
      folderId = search.result.files[0].id;
      showToast(`기존 '${folderName}' 폴더를 발견하여 연동합니다.`, "info");
    } else {
      // 2. 없으면 생성
      const resp = await gapi.client.drive.files.create({
        resource: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder'
        },
        fields: 'id'
      });
      folderId = resp.result.id;
      showToast(`새로운 '${folderName}' 폴더를 생성했습니다.`, "success");
    }

    // 3. 연동
    const { selectLockerFolder } = await import('./ui.js');
    selectLockerFolder(folderName, folderId);
    
    // 4. 즉시 파일 업로드 시도 (백업)
    await syncEventsToDrive();
  } catch (err) {
    console.error("Auto Folder Creation Error:", err);
    showToast("폴더 자동 생성 중 오류가 발생했습니다.", "error");
  }
}

// 📂 로그인 후 다음 로직: 폴더 리스트 연동 및 선택
export async function fetchDriveFolders() {
  try {
    if (!gapi?.client?.drive) {
        console.warn("⚠️ GAPI Drive client not ready yet.");
        return [];
    }
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
    if (!gapi?.client?.drive) {
        console.warn("⚠️ GAPI Drive client not ready for files.");
        return [];
    }
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

async function pickerCallback(data) {
  if (data.action === google.picker.Action.PICKED) {
    const doc = data.docs[0];
    const name = doc.name;
    const id = doc.id;
    
    // UI 모듈의 글로벌 함수 호출
    const { selectLockerFolder } = await import('./ui.js');
    selectLockerFolder(name, id);
  }
}
/**
 * ☁️ [MARKDOWN SYNC] 개별 .md 파일로 보관함 데이터 동기화 (v14.0)
 * YAML Frontmatter를 포함한 마크다운 형식으로 저장하여 가독성과 범용성 확보.
 */
export async function syncEventsToDrive() {
    if (!state.lockerFolderId || isSyncing) return;
    isSyncing = true;

    try {
        console.log("☁️ [SYNC] Starting Markdown Differential Sync...");
        
        // 1. 기존 드라이브 파일 목록 조회 (ID 매핑용)
        const existingFilesResponse = await gapi.client.drive.files.list({
            q: `'${state.lockerFolderId}' in parents and trashed = false and mimeType = 'text/markdown'`,
            fields: "files(id, name, properties)"
        });
        const driveFileMap = new Map(existingFilesResponse.result.files.map(f => [f.name, f.id]));

        let syncCount = 0;

        // 2. 각 이벤트를 개별 .md 파일로 변환 및 업로드
        for (const ev of eventStore) {
            const fileName = `${ev.title.replace(/[\\/:*?"<>|]/g, '_')}_${ev.id.substring(0, 6)}.md`;
            const content = generateMarkdown(ev);
            const currentHash = content.length + "_" + ev.tags.length;

            if (syncFingerprints.get(ev.id) === currentHash) continue; // 변경 없으면 건너뜀

            const existingId = driveFileMap.get(fileName);
            const fileId = await uploadMarkdownFile(fileName, content, state.lockerFolderId, existingId);
            
            if (fileId) {
                syncFingerprints.set(ev.id, currentHash);
                syncCount++;
            }
            
            // API 할당량 조절을 위한 미세 지연
            if (syncCount % 5 === 0) await new Promise(r => setTimeout(r, 100));
        }

        if (syncCount > 0) {
            console.log(`✅ [SYNC] Total ${syncCount} files updated to Cloud.`);
            showToast(`${syncCount}건의 메모가 클라우드에 백업되었습니다.`, "success");
        }

    } catch (err) {
        console.error("Markdown Sync Error:", err);
    } finally {
        isSyncing = false;
    }
}

/**
 * 📄 YAML 프론트매터 포함 마크다운 생성기
 */
function generateMarkdown(ev) {
    const yaml = [
        '---',
        `id: ${ev.id}`,
        `title: "${ev.title.replace(/"/g, '\\"')}"`,
        `region: ${ev.region || 'Unknown'}`,
        `lat: ${ev.lat}`,
        `lng: ${ev.lng}`,
        `category: ${ev.category || 'poi'}`,
        `tags: [${ev.tags.map(t => `"${t}"`).join(', ')}]`,
        `created_at: ${new Date(ev.timestamp || Date.now()).toISOString()}`,
        '---',
        '',
        `# ${ev.title}`,
        '',
        ev.description || ev.summary || '내용이 없습니다.',
        '',
        ev.imageUrl ? `![Thumbnail](${ev.imageUrl})` : '',
        '',
        '---',
        '*Auto-generated by Kuzmo Archive*'
    ].join('\n');
    return yaml;
}

/**
 * 마크다운 전용 업로드 헬퍼
 */
async function uploadMarkdownFile(name, content, parentId, existingId = null) {
    try {
        const metadata = { 
            name, 
            parents: [parentId], 
            mimeType: 'text/markdown'
        };

        if (existingId) {
            // Update
            const resp = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${gapi.client.getToken().access_token}` },
                body: content
            });
            return existingId;
        } else {
            // Create
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', new Blob([content], { type: 'text/markdown' }));

            const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${gapi.client.getToken().access_token}` },
                body: form
            });
            const result = await resp.json();
            return result.id;
        }
    } catch (err) {
        console.error(`Upload error [${name}]:`, err);
        return null;
    }
}

/**
 * 전용 파일 업로드 헬퍼 (Create or Update)
 */
async function uploadFile(name, content, parentId, existingId = null) {
    try {
        let fileId = existingId;
        
        // ID가 없으면 이름으로 다시 조회 (중복 생성 방지)
        if (!fileId) {
            const search = await gapi.client.drive.files.list({
                q: `name = '${name}' and '${parentId}' in parents and trashed = false`,
                fields: "files(id)"
            });
            fileId = search.result.files[0]?.id;
        }

        if (fileId) {
            // Update
            await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${gapi.client.getToken().access_token}` },
                body: content
            });
            return fileId;
        } else {
            // Create
            const metadata = { name, parents: [parentId], mimeType: 'application/json' };
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', new Blob([content], { type: 'application/json' }));

            const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${gapi.client.getToken().access_token}` },
                body: form
            });
            const result = await resp.json();
            return result.id;
        }
    } catch (err) {
        console.error(`Upload error [${name}]:`, err);
        return null;
    }
}



/**
 * 🕵️ [DEEP SYNC AUDIT] 로컬 vs 클라우드 1:1 정밀 비교 검사 (v7.0 Manifest 지원)
 */
export async function deepSyncAudit() {
  if (!state.isLockerSynced || !state.lockerFolderId) {
    return showToast("구글 드라이브 연동이 필요합니다.", "info");
  }

  showToast("클라우드 데이터 정밀 대조 시작...", "info");
  
  try {
    const manifestName = "kuzmo_manifest.v1.json";
    const search = await gapi.client.drive.files.list({
      q: `name = '${manifestName}' and '${state.lockerFolderId}' in parents and trashed = false`,
      fields: "files(id)"
    });

    const manifestId = search.result.files[0]?.id;
    if (!manifestId) {
      return showToast("클라우드 매니페스트를 찾을 수 없습니다.", "warning");
    }

    const manifestResp = await gapi.client.drive.files.get({ fileId: manifestId, alt: 'media' });
    const manifest = typeof manifestResp.result === 'string' ? JSON.parse(manifestResp.result) : manifestResp.result;
    
    const cloudAllEvents = [];
    if (manifest.chunks) {
        for (const [region, fileId] of Object.entries(manifest.chunks)) {
            const chunkResp = await gapi.client.drive.files.get({ fileId, alt: 'media' });
            const chunkData = typeof chunkResp.result === 'string' ? JSON.parse(chunkResp.result) : chunkResp.result;
            if (Array.isArray(chunkData)) cloudAllEvents.push(...chunkData);
        }
    }

    // 🔍 정밀 비교 수행
    const localMap = new Map(eventStore.map(e => [e.id, e]));
    const cloudMap = new Map(cloudAllEvents.map(e => [e.id, e]));

    const onlyLocal = eventStore.filter(e => !cloudMap.has(e.id));
    const onlyCloud = cloudAllEvents.filter(e => !localMap.has(e.id));
    
    // 내용 불일치 체크
    const mismatches = [];
    localMap.forEach((localItem, id) => {
      if (cloudMap.has(id)) {
        const cloudItem = cloudMap.get(id);
        if (JSON.stringify(localItem) !== JSON.stringify(cloudItem)) {
          mismatches.push({ id, title: localItem.title, diff: "Content mismatch" });
        }
      }
    });

    const report = {
      success: true,
      timestamp: new Date().toISOString(),
      localTotal: eventStore.length,
      cloudTotal: cloudMap.size,
      status: (onlyLocal.length === 0 && onlyCloud.length === 0 && mismatches.length === 0) ? "PERFECT_MATCH" : "DISCREPANCY_FOUND",
      details: { onlyLocal, onlyCloud, mismatches }
    };

    console.group("📑 [DEEP SYNC AUDIT REPORT v7.0]");
    console.table({
      "Local Count": report.localTotal,
      "Cloud Count": report.cloudTotal,
      "Only Local": onlyLocal.length,
      "Only Cloud": onlyCloud.length,
      "Mismatches": mismatches.length,
      "Status": report.status
    });
    console.groupEnd();

    if (report.status === "PERFECT_MATCH") {
      showToast("✅ 클라우드와 1:1 완벽하게 일치합니다!", "success");
    } else {
      showToast(`검사 완료: 불일치 발견 (${onlyLocal.length + onlyCloud.length + mismatches.length}건)`, "warning");
    }

    return report;

  } catch (err) {
    console.error("Deep Sync Audit Failure:", err);
    showToast("정밀 검사 중 오류가 발생했습니다.", "error");
    return { success: false, error: err };
  }
}

// End of auth.js
