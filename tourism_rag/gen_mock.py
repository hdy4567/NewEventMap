
import random

def generate_mock_data():
    korea_cities = [
        ("서울", 37.5665, 126.9780, "#3b82f6"),
        ("부산", 35.1796, 129.0756, "#ef4444"),
        ("인천", 37.4563, 126.7052, "#10b981"),
        ("대구", 35.8714, 128.6014, "#f59e0b"),
        ("대전", 36.3504, 127.3845, "#0ea5e9"),
        ("광주", 35.1595, 126.8526, "#8b5cf6"),
        ("울산", 35.5384, 129.3114, "#22c55e"),
        ("제주", 33.4996, 126.5312, "#f43f5e")
    ]
    
    japan_cities = [
        ("도쿄", 35.6762, 139.6503, "#6366f1"),
        ("오사카", 34.6937, 135.5023, "#ea580c"),
        ("교토", 35.0116, 135.7681, "#b45309"),
        ("삿포로", 43.0618, 141.3545, "#38bdf8"),
        ("후쿠오카", 33.5904, 130.4017, "#ec4899"),
        ("나하", 26.2124, 127.6809, "#14b8a6")
    ]
    
    themes = ["문화", "음식", "관광", "축제", "휴양"]
    content_types = ["text", "video", "audio", "image"]
    
    output = "import '../models/event_item.dart';\n\nfinal List<EventItem> mockEvents = [\n"
    
    item_id = 1
    
    # Korea data (~180 items)
    for city, clat, clng, color in korea_cities:
        for i in range(23):
            lat = clat + random.uniform(-0.05, 0.05)
            lng = clng + random.uniform(-0.05, 0.05)
            theme = random.choice(themes)
            output += f"""  EventItem(
    id: {item_id},
    title: "{city} {theme} 장소 {i+1}",
    lat: {lat:.6f},
    lng: {lng:.6f},
    country: "Korea",
    region: "{city}",
    tags: ["{city}", "{theme}", "답사"],
    theme: "{theme}",
    celeb: [],
    imageUrl: "https://picsum.photos/seed/{item_id}/600/400",
    summary: "{city} {theme} 관련 상세 기록입니다.",
    color: "{color}",
    contents: [
      Content(type: 'text', value: '{city} 현장 답사 내용 기록입니다. {i+1}번 항목.'),
      {f"Content(type: '{random.choice(content_types[1:])}', value: 'https://example.com/res_{item_id}')," if random.random() > 0.6 else ""}
    ],
  ),
"""
            item_id += 1

    # Japan data (~120 items)
    for city, clat, clng, color in japan_cities:
        for i in range(20):
            lat = clat + random.uniform(-0.05, 0.05)
            lng = clng + random.uniform(-0.05, 0.05)
            theme = random.choice(themes)
            output += f"""  EventItem(
    id: {item_id},
    title: "{city} {theme} Spot {i+1}",
    lat: {lat:.6f},
    lng: {lng:.6f},
    country: "Japan",
    region: "{city}",
    tags: ["{city}", "{theme}", "Tour"],
    theme: "{theme}",
    celeb: [],
    imageUrl: "https://picsum.photos/seed/{item_id}/600/400",
    summary: "{city} {theme} site visit log.",
    color: "{color}",
    contents: [
      Content(type: 'text', value: 'Visit log for {city} {theme} site {i+1}.'),
      {f"Content(type: '{random.choice(content_types[1:])}', value: 'https://example.com/res_{item_id}')," if random.random() > 0.7 else ""}
    ],
  ),
"""
            item_id += 1
            
    # Add some Memos
    for i in range(10):
        lat = 37.5 + random.uniform(-1, 1)
        lng = 127.0 + random.uniform(-1, 1)
        output += f"""  EventItem(
    id: {item_id},
    title: "현장 메모 {i+1}",
    lat: {lat:.6f},
    lng: {lng:.6f},
    country: "Memo",
    region: "서울",
    tags: ["메모", "체크"],
    theme: "기획",
    celeb: [],
    imageUrl: "https://picsum.photos/seed/m{i}/600/400",
    summary: "급하게 기록한 현장 메모입니다.",
    color: "#71717a",
    contents: [
        Content(type: 'text', value: '메모 내용 {i+1}: 전원 상태 확인 필요.'),
        {f"Content(type: 'audio', value: 'audio_{i}.mp3')," if i % 2 == 0 else ""}
    ],
  ),
"""
        item_id += 1

    output += "];\n"
    
    with open("c:/YOON/CSrepos/NewEventMap/eventmap_flutter/lib/repository/mock_data.dart", "w", encoding="utf-8") as f:
        f.write(output)

if __name__ == "__main__":
    generate_mock_data()
