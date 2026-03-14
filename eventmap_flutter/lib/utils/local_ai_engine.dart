
class LocalAiEngine {
  static final LocalAiEngine instance = LocalAiEngine._();
  LocalAiEngine._();

  // 🚀 추억 관리자(Keeper) 전용 다차원 지식 베이스
  // 장소, 활동, 기록방식, 감정을 다차원으로 분류합니다.
  final Map<String, dynamic> _brainMap = {
    "locations": {
      "@서울": ["서울", "강남", "홍대", "명동", "종로", "잠실", "seoul", "강북", "이태원"],
      "@Japan": ["일본", "도쿄", "오사카", "후쿠오카", "교토", "tokyo", "japan", "sapporo"],
      "@Memo": ["내공간", "보관함", "아카이브", "저장소"],
    },
    "activity": {
      "#맛집": ["맛집", "먹은", "식당", "카페", "푸드", "음식", "디저트", "coffee", "델리"],
      "#풍경": ["풍경", "경치", "야경", "바다", "산", "view", "멋진", "이쁜"],
    },
    "media": {
      "#기록": ["메모", "기록", "생각", "노트", "diary", "memo", "적은", "글"],
      "#음성": ["음성", "녹음", "목소리", "오디오", "말소리", "voice"],
    },
    "mood": {
      "#축제": ["축제", "공연", "파티", "사람많은", "festival"],
      "#조용한": ["조용한", "혼자", "사색", "quiet", "평화로운"],
    }
  };

  /// 🚀 추억꾼 SLM v2.0 (Scoring Engine)
  /// 단순 단어 일치가 아닌, 전체 문장에서 어떤 '의도'가 가장 강한지 점수를 매깁니다.
  Future<String> process(String text) async {
    final lowerText = text.toLowerCase();
    Map<String, double> scores = {};

    // 1. 사용자 명시 태그 우선순위 (+)
    final explicit = RegExp(r"[@#](\w+)").allMatches(text);
    for (var m in explicit) {
      final t = m.group(0)!;
      scores[t] = (scores[t] || 0) + 10.0; // 높은 가중치
    }

    // 2. 브레인 맵 기반 가중치 연산
    _brainMap.forEach((category, tags) {
      (tags as Map<String, List<String>>).forEach((tagName, keywords) {
        for (var k in keywords) {
          if (lowerText.contains(k)) {
            // 카테고리별/단어별 중요도 차등 (일기/메모는 보통 뒤에 오므로 가중치 보정)
            double weight = category == "locations" ? 1.5 : 1.0;
            scores[tagName] = (scores[tagName] || 0) + weight;
          }
        }
      });
    });

    if (scores.isEmpty) return text;

    // AI 분석 딜레이 (데이터 조합 및 추론 연기)
    await Future.delayed(const Duration(milliseconds: 600));

    // 3. 최적의 조합 도출
    // 점수 높은 순으로 정렬하여 상위 태그들을 조합
    var sortedEntries = scores.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    // 장소 1개 + 활동/기분 1~2개 조합
    String? location = sortedEntries.firstWhere((e) => e.key.startsWith('@'), 
        orElse: () => MapEntry("", 0)).key;
    List<String> activities = sortedEntries
        .where((e) => e.key.startsWith('#'))
        .take(2)
        .map((e) => e.key)
        .toList();

    List<String> result = [];
    if (location.isNotEmpty) result.add(location);
    result.addAll(activities);

    return result.isEmpty ? text : result.join(" ");
  }
}
