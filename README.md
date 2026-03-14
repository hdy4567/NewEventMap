# NewEventMap 🌎

전 세계 관광 데이터를 실시간으로 시각화하고, 온디바이스 AI(SLM)를 통해 지능형 맞춤 정보를 제공하는 차세대 이벤트 맵 플랫폼입니다.

## 🚀 주요 기능
- **Google Drive Integration**: Google Picker API를 활용한 안전한 폴더 선택 및 데이터 동기화.
- **On-Device SLM (AI)**: Llama 3.2 1B 모델을 활용하여 로컬 환경에서 지능형 관광 코스 추천.
- **Real-time Map Visualization**: Leaflet.js 기반의 고성능 인터랙티브 맵.
- **Smart Selection**: 드래그 앤 드롭을 통한 대량 핀(Pin) 관리 및 태깅 시스템.

---

## 🚫 업로드 제외 파일 및 복구 방법 (Getting Started)

보안 및 용량상의 이유로 GitHub에 포함되지 않은 파일들은 아래 가이드를 따라 설정해 주세요.

### 1. 환경 변수 설정 (Security)
루트 및 `frontend-web` 폴더에 `.env` 파일을 생성하고 다음 정보를 입력해야 합니다.
- `VITE_GOOGLE_API_KEY`: Google Cloud Console API 키
- `VITE_GOOGLE_CLIENT_ID`: OAuth 2.0 클라이언트 ID
- `VITE_GOOGLE_APP_ID`: 프로젝트 번호 (Project Number)

### 2. AI 모델 다운로드 (Large Storage)
백엔드 AI 엔진 구동을 위해 다음 모델 파일을 다운로드하여 `MonitoringBridge/CSharpServer/models/` 경로에 넣어주세요.
- **Model**: Llama-3.2-1B-Instruct-GGUF
- **Link**: [Download from HuggingFace](https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf)

### 3. 라이브러리 설치 및 실행
```bash
# Frontend
cd eventmap-platform/frontend-web
npm install
npm run dev

# Backend (C# Bridge)
cd MonitoringBridge/CSharpServer
dotnet run
```

---

## 🛠 Tech Stack
- **Frontend**: Vite, Vanilla JS, Leaflet.js, Google Picker API
- **Backend**: .NET 10.0, LLamaSharp (On-device SLM)
- **AI Engine**: Llama 3.2 1B Instruct
- **Storage**: Browser IndexedDB & Google Drive API
