"""
STEP 2: 임베딩 + FAISS 인덱스 구축
====================================
data/merged.json을 읽어 각 관광지를 텍스트로 만들고
sentence-transformers 모델로 벡터화한 후 FAISS에 저장합니다.

실행: python 2_build_index.py
의존: pip install sentence-transformers faiss-cpu
"""

import json
import numpy as np
from pathlib import Path

DATA_DIR  = Path(__file__).parent / "data"
INDEX_DIR = Path(__file__).parent / "index"
INDEX_DIR.mkdir(exist_ok=True)

MERGED_FILE   = DATA_DIR / "merged.json"
FAISS_FILE    = INDEX_DIR / "faiss.index"
METADATA_FILE = INDEX_DIR / "metadata.json"

# 다국어 경량 임베딩 모델 (한국어/일본어 모두 지원)
MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"


# ─────────────────────────────────────────────
# 관광지 데이터 → 임베딩용 텍스트로 변환
# ─────────────────────────────────────────────
def item_to_text(item: dict) -> str:
    """관광지 필드들을 하나의 검색용 문자열로 조합"""
    parts = [
        item.get("title", ""),
        item.get("country", ""),
        item.get("region", ""),
        item.get("theme", ""),
        " ".join(item.get("tags", [])),
        item.get("summary", "")[:200],   # summary는 최대 200자
        item.get("address", ""),
    ]
    return " | ".join(p for p in parts if p).strip()


def build_index():
    # ── 데이터 로드 ──────────────────────────────
    if not MERGED_FILE.exists():
        print("❌ data/merged.json 없음: 먼저 1_fetch_data.py를 실행하세요.")
        return

    with open(MERGED_FILE, encoding="utf-8") as f:
        items: list[dict] = json.load(f)

    print(f"📂 {len(items)}건 로드됨 → 임베딩 시작...")

    # ── 임베딩 모델 로드 ─────────────────────────
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        print("📦 pip install sentence-transformers faiss-cpu")
        return

    model = SentenceTransformer(MODEL_NAME)

    # ── 텍스트 생성 + 임베딩 ─────────────────────
    texts     = [item_to_text(item) for item in items]
    print("🔢 임베딩 계산 중...")
    embeddings = model.encode(texts, show_progress_bar=True, normalize_embeddings=True)
    embeddings = np.array(embeddings, dtype="float32")

    print(f"✅ 임베딩 shape: {embeddings.shape}")

    # ── FAISS 인덱스 생성 ────────────────────────
    try:
        import faiss
    except ImportError:
        print("📦 pip install faiss-cpu")
        return

    dim   = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)   # Inner Product = Cosine (normalize 했으므로)
    index.add(embeddings)

    faiss.write_index(index, str(FAISS_FILE))
    print(f"💾 FAISS 인덱스 저장 → {FAISS_FILE}  ({index.ntotal}개 벡터)")

    # ── 메타데이터 저장 ──────────────────────────
    # 인덱스 번호 <-> 관광지 정보 매핑 테이블
    metadata = [
        {
            "index": i,
            "id":       item.get("id", ""),
            "title":    item.get("title", ""),
            "country":  item.get("country", ""),
            "region":   item.get("region", ""),
            "lat":      item.get("lat", 0),
            "lng":      item.get("lng", 0),
            "theme":    item.get("theme", ""),
            "tags":     item.get("tags", []),
            "summary":  item.get("summary", "")[:300],
            "imageUrl": item.get("imageUrl", ""),
            "address":  item.get("address", ""),
            "wikipedia":item.get("wikipedia", ""),
            "source":   item.get("source", ""),
            "text":     texts[i],
        }
        for i, item in enumerate(items)
    ]

    with open(METADATA_FILE, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)

    print(f"💾 메타데이터 저장 → {METADATA_FILE}")
    print(f"\n🎉 인덱스 구축 완료! 총 {len(items)}개 관광지")


if __name__ == "__main__":
    build_index()
