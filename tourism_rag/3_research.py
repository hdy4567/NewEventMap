"""
STEP 3: RAG 리서치 시스템
==========================
사용자 쿼리(자연어)를 입력하면 FAISS 인덱스에서 가장 유사한
관광지들을 검색하고, 결과를 구조화하여 출력합니다.

실행 방법:
  대화형:  python 3_research.py
  단발성:  python 3_research.py --query "교토 전통 신사 조용한 곳"
  국가 필터: python 3_research.py --query "겨울에 가기 좋은 곳" --country Korea
  JSON 출력: python 3_research.py --query "..해변.." --output json
"""

import json
import argparse
import textwrap
from pathlib import Path

INDEX_DIR     = Path(__file__).parent / "index"
FAISS_FILE    = INDEX_DIR / "faiss.index"
METADATA_FILE = INDEX_DIR / "metadata.json"

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

COLORS = {
    "reset": "\033[0m",
    "bold":  "\033[1m",
    "blue":  "\033[94m",
    "green": "\033[92m",
    "yellow":"\033[93m",
    "red":   "\033[91m",
    "cyan":  "\033[96m",
    "gray":  "\033[90m",
}

FLAG = {"Korea": "🇰🇷", "Japan": "🇯🇵"}


# ─────────────────────────────────────────────
# RAG 검색 엔진 클래스
# ─────────────────────────────────────────────
class TourismRAG:
    def __init__(self):
        self.model  = None
        self.index  = None
        self.metadata: list[dict] = []
        self._loaded = False

    def load(self):
        if self._loaded:
            return
        
        # 의존성 체크
        try:
            from sentence_transformers import SentenceTransformer
            import faiss, numpy as np
        except ImportError:
            print("❌ 의존 패키지 부족: pip install sentence-transformers faiss-cpu")
            raise

        # 파일 체크
        if not FAISS_FILE.exists() or not METADATA_FILE.exists():
            print("❌ 인덱스 없음: 먼저 2_build_index.py를 실행하세요.")
            raise FileNotFoundError("index not found")

        print("📦 모델 로딩 중... (최초 1회만)")
        self.model = SentenceTransformer(MODEL_NAME)

        import faiss
        self.index = faiss.read_index(str(FAISS_FILE))

        with open(METADATA_FILE, encoding="utf-8") as f:
            self.metadata = json.load(f)

        self._loaded = True
        print(f"✅ 인덱스 로드 완료: {self.index.ntotal}개 관광지\n")

    def search(
        self,
        query: str,
        top_k: int = 5,
        country: str | None = None,
    ) -> list[dict]:
        import numpy as np
        
        # 쿼리 임베딩
        vec = self.model.encode([query], normalize_embeddings=True)
        vec = np.array(vec, dtype="float32")

        # 후처리 필터를 위해 더 많이 가져온 뒤 자름
        fetch_k = top_k * 5 if country else top_k
        distances, indices = self.index.search(vec, min(fetch_k, self.index.ntotal))

        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx < 0 or idx >= len(self.metadata):
                continue
            item = self.metadata[idx].copy()

            # 국가 필터
            if country and item.get("country", "").lower() != country.lower():
                continue

            item["score"] = round(float(dist), 4)
            results.append(item)

            if len(results) >= top_k:
                break

        return results


# ─────────────────────────────────────────────
# 결과 출력
# ─────────────────────────────────────────────
def print_results(results: list[dict], query: str):
    C = COLORS
    print(f"\n{C['bold']}{C['cyan']}🔍 쿼리: \"{query}\"{C['reset']}")
    print(f"{C['gray']}{'─'*60}{C['reset']}\n")

    if not results:
        print(f"{C['red']}결과 없음{C['reset']}")
        return

    for i, item in enumerate(results, 1):
        flag  = FLAG.get(item.get("country", ""), "🌏")
        score = item.get("score", 0)
        bar   = "█" * int(score * 20)

        print(f"{C['bold']}{i}. {flag} {item['title']}{C['reset']}")
        print(f"   {C['gray']}국가:{C['reset']} {item.get('country','')}  "
              f"{C['gray']}지역:{C['reset']} {item.get('region','')}  "
              f"{C['gray']}테마:{C['reset']} {item.get('theme','')}")
        print(f"   {C['gray']}좌표:{C['reset']} ({item.get('lat',0):.4f}, {item.get('lng',0):.4f})")
        print(f"   {C['gray']}태그:{C['reset']} {', '.join(item.get('tags', []))}")

        if item.get("summary"):
            summary = textwrap.fill(item["summary"][:150], width=60, initial_indent="   ")
            print(f"   {C['gray']}요약:{C['reset']} {summary}")

        print(f"   {C['green']}유사도:{C['reset']} {C['yellow']}{bar}{C['reset']} {score:.4f}")
        print()


# ─────────────────────────────────────────────
# 메인 진입점
# ─────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Tourism RAG Research System")
    parser.add_argument("--query",   type=str, default=None, help="검색 쿼리 (없으면 대화형 모드)")
    parser.add_argument("--top_k",  type=int, default=5,    help="반환할 최대 결과 수")
    parser.add_argument("--country", type=str, default=None, choices=["Korea", "Japan", None],
                        help="국가 필터 (Korea / Japan)")
    parser.add_argument("--output", type=str, default="pretty", choices=["pretty", "json"],
                        help="출력 형식")
    args = parser.parse_args()

    rag = TourismRAG()
    rag.load()

    def run_query(query: str):
        results = rag.search(query, top_k=args.top_k, country=args.country)
        if args.output == "json":
            print(json.dumps(results, ensure_ascii=False, indent=2))
        else:
            print_results(results, query)

    if args.query:
        # 단발성 쿼리 모드
        run_query(args.query)
    else:
        # 대화형 모드
        print(f"""
{COLORS['bold']}{COLORS['cyan']}╔══════════════════════════════════════╗
║   🌏 Tourism RAG Research System     ║
║   한국 + 일본 관광지 AI 검색         ║
╚══════════════════════════════════════╝{COLORS['reset']}

예시 쿼리:
  "교토에서 조용한 신사"
  "겨울에 눈 구경할 수 있는 곳"
  "부산 바다 근처 먹거리"
  "WW2 역사 유적"
  "아이와 함께 할 수 있는 테마파크"

(종료: q 또는 Ctrl+C)
        """)
        while True:
            try:
                query = input(f"{COLORS['bold']}❯ 검색어 입력: {COLORS['reset']}").strip()
            except (KeyboardInterrupt, EOFError):
                print("\n\n👋 종료")
                break

            if not query or query.lower() in ("q", "quit", "exit", "종료"):
                print("\n👋 종료")
                break

            run_query(query)


if __name__ == "__main__":
    main()
