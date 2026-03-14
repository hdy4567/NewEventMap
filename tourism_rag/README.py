"""
tourism_rag/
├── 1_fetch_data.py       ← 관광 데이터 수집 (TourAPI KR + Overpass JP)
├── 2_build_index.py      ← 임베딩 + FAISS 인덱스 구축
├── 3_research.py         ← RAG 검색 시스템 (쿼리 → 관광지 추천)
├── data/
│   ├── raw_korea.json    ← TourAPI에서 가져온 원본 데이터
│   ├── raw_japan.json    ← Overpass에서 가져온 원본 데이터
│   └── merged.json       ← 병합된 정제 데이터
└── index/
    ├── faiss.index       ← 벡터 인덱스 파일
    └── metadata.json     ← 인덱스 <-> 관광지 매핑 테이블
"""
