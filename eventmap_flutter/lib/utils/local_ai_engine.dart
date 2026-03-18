
class LocalAiEngine {
  static final LocalAiEngine instance = LocalAiEngine._();
  LocalAiEngine._();

  // 🚀 [ON-DEVICE BRAIN] Core Region Knowledge
  final Map<String, List<String>> _regions = {
    "@서울": ["서울", "강남", "홍대", "명동", "종로", "잠실", "강북", "이태원", "seoul"],
    "@부산": ["부산", "해운데", "광안리", "서면", "busan"],
    "@제주도": ["제주", "서귀포", "성산", "애월", "jeju"],
    "@도쿄": ["도쿄", "신주쿠", "시부야", "긴자", "tokyo"],
    "@오사카": ["오사카", "도톤보리", "난바", "osaka"],
    "@교토": ["교토", "청수사", "kyoto"],
    "@후쿠오카": ["후쿠오카", "하카타", "텐진", "fukuoka"],
    "@Memo": ["내공간", "보관함", "아카이브", "저장소", "메모"],
  };

  // 🚀 [ON-DEVICE BRAIN] Core Category Knowledge
  final Map<String, List<String>> _categories = {
    "#맛집": ["맛집", "식당", "카페", "푸드", "음식", "디저트", "디너", "점심", "coffee", "restaurant"],
    "#숙소": ["호텔", "숙소", "숙박", "펜션", "게하", "hotel", "resort", "stay"],
    "#풍경": ["풍경", "경치", "야경", "바다", "산", "view", "멋진", "이쁜", "nature"],
    "#축제": ["축제", "공연", "파티", "행사", "festival", "event"],
    "#박물관": ["박물관", "미술관", "전시", "museum", "gallery"],
    "#쇼핑": ["쇼핑", "백화점", "마트", "shopping", "mall"],
    "#기록": ["생각", "노트", "diary", "memo", "적은", "글", "일기"],
  };

  /// 🧠 On-Device Semantic Labeling (v3.0)
  /// Returns a Map containing suggestedRegion and suggestedCategory
  Future<Map<String, String?>> label(String text) async {
    final lowerText = text.toLowerCase();
    
    String? suggestedRegion;
    String? suggestedCategory;

    // 1. Region Matching (Scoring)
    double topRegionScore = 0;
    _regions.forEach((tag, keywords) {
      double score = 0;
      for (var k in keywords) {
        if (lowerText.contains(k.toLowerCase())) score += 1.0;
      }
      if (score > topRegionScore) {
        topRegionScore = score;
        suggestedRegion = tag;
      }
    });

    // 2. Category Matching (Scoring)
    double topCategoryScore = 0;
    _categories.forEach((tag, keywords) {
      double score = 0;
      for (var k in keywords) {
        if (lowerText.contains(k.toLowerCase())) score += 1.0;
      }
      if (score > topCategoryScore) {
        topCategoryScore = score;
        suggestedCategory = tag;
      }
    });

    return {
      "suggestedRegion": suggestedRegion,
      "suggestedCategory": suggestedCategory,
    };
  }

  /// 🚀 Intent Analysis (On-Device Fallback for Chat)
  Future<String> process(String text) async {
    final result = await label(text);
    final List<String> tags = [];
    if (result["suggestedRegion"] != null) tags.add(result["suggestedRegion"]!);
    if (result["suggestedCategory"] != null) tags.add(result["suggestedCategory"]!);

    if (tags.isEmpty) return text;
    
    // Simulating thinking...
    await Future.delayed(const Duration(milliseconds: 300));
    return tags.join(" ");
  }
}
