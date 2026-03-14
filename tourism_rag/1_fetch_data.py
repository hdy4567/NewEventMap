"""
STEP 1: 관광 데이터 수집 스크립트
=================================
한국: 한국관광공사 TourAPI 4.0 (data.go.kr)
일본: Overpass API (OpenStreetMap)

실행: python 1_fetch_data.py
     python 1_fetch_data.py --country korea
     python 1_fetch_data.py --country japan

설정:
  KOREA_API_KEY 환경변수 또는 아래 직접 입력
"""

import requests
import json
import os
import time
import argparse
from pathlib import Path

# ─────────────────────────────────────────────
# 설정
# ─────────────────────────────────────────────
KOREA_API_KEY = os.environ.get("TOUR_API_KEY", "f3cef6880b1b8a3ea1830dbab6205ebeac41ed6ddb484a897f3c51b6ec0e79fb")  # data.go.kr 발급

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# ─────────────────────────────────────────────
# 한국 관광지 수집 (TourAPI 4.0)
# ─────────────────────────────────────────────
def fetch_korea_attractions(max_total: int = 1000) -> list[dict]:
    """TourAPI 4.0의 '지역기반 관광정보조회' 엔드포인트로 데이터 수집"""
    url = "http://apis.data.go.kr/B551011/KorService1/areaBasedList1"
    all_items = []
    
    area_codes = {
        "1": "서울", "2": "인천", "3": "대전", "4": "대구",
        "5": "광주", "6": "부산", "7": "울산", "8": "세종",
        "31": "경기도", "32": "강원도", "33": "충청북도", "34": "충청남도",
        "35": "경상북도", "36": "경상남도", "37": "전라북도", "38": "전라남도",
        "39": "제주",
    }

    content_types = ["12", "14", "15"]

    for area_code, area_name in area_codes.items():
        if len(all_items) >= max_total:
            break
            
        for content_type in content_types:
            if len(all_items) >= max_total:
                break
                
            params = {
                "serviceKey": KOREA_API_KEY,
                "numOfRows": 50,
                "pageNo": 1,
                "MobileOS": "ETC",
                "MobileApp": "EventMapRAG",
                "_type": "json",
                "areaCode": area_code,
                "contentTypeId": content_type,
                "arrange": "A",
            }
            try:
                # 보안: URL에 키가 직접 노출되지 않도록 params로 전달 (내부적으로는 전달되지만 로그 등에서 방어)
                resp = requests.get(url, params=params, timeout=15)
                
                # 500 에러 처리 (API 키 활성화 대기 등)
                if resp.status_code == 500:
                    print(f"  ⚠️ [{area_name}] 서버 응답 500. 키 활성화를 기다려야 할 수도 있습니다.")
                    continue
                    
                resp.raise_for_status()
                data = resp.json()
                
                # 결과 코드 확인
                result_code = data.get("response", {}).get("header", {}).get("resultCode")
                if result_code != "0000":
                    msg = data.get("response", {}).get("header", {}).get("resultMsg")
                    print(f"  ⚠️ [{area_name}] API 에러 ({result_code}): {msg}")
                    continue

                body = data.get("response", {}).get("body", {})
                items = body.get("items", {})
                if not items:
                    continue
                    
                item_list = items.get("item", [])
                if isinstance(item_list, dict):
                    item_list = [item_list]

                for item in item_list:
                    if len(all_items) >= max_total:
                        break
                    all_items.append({
                        "id": item.get("contentid", ""),
                        "title": item.get("title", ""),
                        "country": "Korea",
                        "region": area_name,
                        "lat": float(item.get("mapy", 0) or 0),
                        "lng": float(item.get("mapx", 0) or 0),
                        "theme": {"12": "관광지", "14": "문화시설", "15": "행사/축제"}.get(content_type, "기타"),
                        "address": item.get("addr1", ""),
                        "imageUrl": item.get("firstimage", ""),
                        "summary": item.get("overview", ""),
                        "tags": [area_name, {"12": "관광지", "14": "문화시설", "15": "축제"}.get(content_type, "기타")],
                        "source": "TourAPI_4.0",
                    })
                print(f"  ✅ [{area_name}] 현재 누적: {len(all_items)}건")
                time.sleep(0.3)

            except Exception as e:
                print(f"  ❌ [{area_name}] 오류: {e}")

    print(f"\n🇰🇷 한국 총 {len(all_items)}건 수집 완료")
    return all_items


# ─────────────────────────────────────────────
# 일본 관광지 수집 (Overpass API)
# ─────────────────────────────────────────────
def fetch_japan_attractions() -> list[dict]:
    """Overpass QL 쿼리로 일본 내 주요 관광지(POI) 수집"""
    query = """
    [out:json][timeout:60];
    area["name:en"="Japan"]->.jp;
    (
      node["tourism"="attraction"](area.jp);
      node["tourism"="museum"](area.jp);
      node["tourism"="theme_park"](area.jp);
      node["historic"="castle"](area.jp);
      node["historic"="shrine"](area.jp);
      node["historic"="ruins"](area.jp);
    );
    out body;
    """
    print("🇯🇵 Overpass API 쿼리 중...")
    try:
        resp = requests.post(OVERPASS_URL, data={"data": query}, timeout=90)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"  ❌ Overpass API 오류: {e}")
        return []

    elements = data.get("elements", [])
    japan_items = []

    for elem in elements:
        tags = elem.get("tags", {})
        name = tags.get("name:ko") or tags.get("name:en") or tags.get("name", "이름없음")
        if not name or name == "이름없음":
            continue
        lat = elem.get("lat", 0)
        lng = elem.get("lon", 0)
        if not lat or not lng:
            continue

        tourism_tag = tags.get("tourism", "")
        historic_tag = tags.get("historic", "")
        theme = {
            "attraction": "관광지", "museum": "박물관",
            "theme_park": "테마파크", "castle": "성",
            "shrine": "신사", "ruins": "유적",
        }.get(tourism_tag or historic_tag, "관광지")

        # 광역 지역 추정 (주소 기반)
        addr = tags.get("addr:province") or tags.get("addr:city") or "일본"

        japan_items.append({
            "id": str(elem.get("id", "")),
            "title": name,
            "country": "Japan",
            "region": addr,
            "lat": lat,
            "lng": lng,
            "theme": theme,
            "address": tags.get("addr:full", ""),
            "imageUrl": tags.get("image", ""),
            "summary": tags.get("description", f"일본의 {theme}"),
            "tags": [theme, "일본"],
            "wikipedia": tags.get("wikipedia", ""),
            "source": "Overpass_OSM",
        })

    print(f"🇯🇵 일본 총 {len(japan_items)}건 수집 완료")
    return japan_items


# ─────────────────────────────────────────────
# 병합 및 저장
# ─────────────────────────────────────────────
def save(data: list[dict], path: Path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"💾 저장 완료 → {path.name}  ({len(data)}건)")


def main():
    parser = argparse.ArgumentParser(description="Tourism Data Fetcher")
    parser.add_argument("--country", choices=["korea", "japan", "all"], default="all")
    parser.add_argument("--rows", type=int, default=50)
    args = parser.parse_args()

    all_data = []

    if args.country in ("korea", "all"):
        if KOREA_API_KEY == "f3cef6880b1b8a3ea1830dbab6205ebeac41ed6ddb484a897f3c51b6ec0e79fb" or not KOREA_API_KEY:
            # 기본값(사용자 수정 전)일 경우 경고만 출력하고 진행하거나 처리
            # 하지만 사용자가 이 값을 실제 키로 쓴다면 if 조건을 통과하게 해야 함. 
            # 여기서는 'YOUR_TOUR_API_KEY_HERE' 대신 현재 설정된 값을 체크하도록 변경.
            pass
        
        kr_data = fetch_korea_attractions(max_total=1000)
        save(kr_data, DATA_DIR / "raw_korea.json")
        all_data.extend(kr_data)

    if args.country in ("japan", "all"):
        jp_data = fetch_japan_attractions()
        save(jp_data, DATA_DIR / "raw_japan.json")
        all_data.extend(jp_data)

    if all_data:
        save(all_data, DATA_DIR / "merged.json")
        print(f"\n✅ 병합 완료: 총 {len(all_data)}건 → data/merged.json")


if __name__ == "__main__":
    main()
