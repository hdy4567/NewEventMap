using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Net.WebSockets;
using System.Threading;
using System.Threading.Tasks;
using System.Linq;
using System.Text.RegularExpressions;
using System.Text;
using System.Security.Cryptography;

namespace MonitoringBridge.Server
{
    /**
     * 🚀 RAG Research-Driven Models (v2025.3)
     * Based on TP-RAG (arXiv:2504.08694) & EvoRAG logic.
     */
    public class Trajectory
    {
        public string Region { get; set; } = "";
        public List<TourismInfo> Points { get; set; } = new List<TourismInfo>();
        public double EfficiencyScore { get; set; } // Distance vs Coverage
        public double DiversityScore { get; set; } // Variety of tags
        public double RelevanceScore { get; set; } // 🚀 추가: 사용자 쿼리와의 연관성 점수
        public string Reasoning { get; set; } = ""; // 🚀 추가: 경로 선택 이유 (CoT)
    }

    public class TourismInfo
    {
        public string Name { get; set; } = "";
        public string Description { get; set; } = "";
        public List<string> Tags { get; set; } = new List<string>();
        public double Lat { get; set; }
        public double Lng { get; set; }
        public string Category { get; set; } = "poi"; // 🚀 추가: 명시적 카테고리
        public Dictionary<string, double> Neighbors { get; set; } = new Dictionary<string, double>(); // 🚀 Graph: 근접 POI 리스트 (Name, Distance)
    }

    /**
     * 🚀 UniversalKnowledgeEngine (Zero-Hardcoding Version)
     * 어떤 리스트나 좌표 하드코딩 없이, Wikipedia의 좌표(coordinates) 데이터를 기반으로 
     * 전 세계 어디든 실시간으로 지식을 수집하고 "쌓는" 시스템입니다.
     */
    public class DynamicKnowledgeLibrary
    {
        private static readonly string CachePath = @"c:\YOON\CSrepos\NewEventMap\MonitoringBridge\CSharpServer\global_knowledge_cache.json";
        private Dictionary<string, List<TourismInfo>> _cache = new Dictionary<string, List<TourismInfo>>();
        private readonly HttpClient _httpClient = new HttpClient();
        private bool _stopRequested = false;
        private const int GLOBAL_CAPACITY = 20000; // 서버 전체 캐시 최대 개수 (성능 최적화 범위 내 확장)
        private const int REGION_CAPACITY = 1000;  // 한 지역당 넉넉한 수집 허용 (기본 1000 + 여유분)

        // 🚀 API 비용/과부하 방지: 일일 요청 카운터 (v11.6)
        private int _dailyApiCount = 0;
        private DateTime _lastApiReset = DateTime.Now.Date;
        private const int MAX_DAILY_CALLS = 10000;

        private static readonly Dictionary<string, (double Lat, double Lng)> FallbackCoords = new Dictionary<string, (double, double)>
        {
            { "서울", (37.5665, 126.9780) }, { "부산", (35.1796, 129.0756) }, { "제주도", (33.4996, 126.5312) },
            { "강릉", (37.7519, 128.8761) }, { "경주", (35.8562, 129.2247) }, { "인천", (37.4563, 126.7052) },
            { "속초", (38.2070, 128.5915) }, { "전주", (35.8242, 127.1480) }, { "광주", (35.1595, 126.8526) },
            { "대구", (35.8714, 128.6014) }, { "대전", (36.3504, 127.3845) }, { "여수", (34.7604, 127.6622) },
            { "춘천", (37.8813, 127.7298) }, { "강원도", (37.8228, 128.1555) },
            { "도쿄", (35.6895, 139.6917) }, { "오사카", (34.6937, 135.5023) }, { "교토", (35.0116, 135.7681) },
            { "삿포로", (43.0621, 141.3544) }, { "후쿠오카", (33.5904, 130.4017) }, { "오키나와", (26.2124, 127.6809) }, { "오키나와현", (26.2124, 127.6809) },
            { "홋카이도", (43.0642, 141.3469) }
        };

        public DynamicKnowledgeLibrary()
        {
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "EventMapBot/1.0 (contact: yoon@example.com)");
            LoadCache();
            SanitizeCache(); // 🚀 시작 시 잘못된 좌표 정화
        }

        private void SanitizeCache()
        {
            int removed = 0;
            int jejuSlimmed = 0;
            foreach (var key in _cache.Keys.ToList())
            {
                // 1. Lat:0인 불량 데이터 삭제
                if (_cache[key].Any(x => x.Lat == 0))
                {
                    _cache.Remove(key);
                    removed++;
                    continue;
                }

                // 2. 🚀 [DIET LOGIC] 제주도 데이터가 너무 많을 경우 (1000건 넘으면 전량 삭제, 150건 넘으면 다이어트)
                if (key.Contains("제주"))
                {
                    int currentCount = _cache[key].Count;
                    if (currentCount > 1000)
                    {
                        _cache.Remove(key);
                        jejuSlimmed += currentCount;
                        continue; // 삭제했으므로 다음 지역으로
                    }
                    else if (currentCount > 150)
                    {
                        int targetCount = currentCount / 2;
                        _cache[key] = _cache[key].Take(targetCount).ToList();
                        jejuSlimmed += (currentCount - targetCount);
                    }
                }

                // 3. 🚀 [GLOBAL QUOTA] 모든 지역 데이터는 최대 REGION_CAPACITY개로 제한
                if (_cache[key].Count > REGION_CAPACITY)
                {
                    _cache[key] = _cache[key].Take(REGION_CAPACITY).ToList();
                    removed += (_cache[key].Count - REGION_CAPACITY);
                }
            }
            if (removed > 0 || jejuSlimmed > 0)
            {
                SaveCache();
                Console.WriteLine($"[BALANCE] Purged {removed} invalid/excess items. Jeju dieted {jejuSlimmed} items.");
            }

            // 🚀 [GLOBAL PRUNE] 전체 합계가 GLOBAL_CAPACITY건을 넘지 않도록 강제 조정
            PruneGlobal(GLOBAL_CAPACITY);
        }

        /**
         * 🚀 EvoRAG v2.0: Agentic Constraint-Aware Trajectory Planning
         * 사용자 쿼리의 키워드와 시공간적 제약(거리)을 동시에 최적화합니다.
         */
        public List<Trajectory> EvolutionPlanning(string region, string userQuery = "", int populationSize = 8)
        {
            if (!_cache.ContainsKey(region)) return new List<Trajectory>();

            var pool = _cache[region];
            if (pool.Count < 3) return new List<Trajectory>();

            // 1. Graph Construction (On-the-fly 근접 링크 구축)
            BuildLocalGraph(pool);

            var population = new List<Trajectory>();
            var rnd = new Random();

            // 2. Initial Population: 가중치 무작위 샘플링
            for (int i = 0; i < populationSize; i++)
            {
                var proto = new Trajectory { Region = region };
                // 쿼리 관련 키워드가 있는 POI 우선 선택 시도
                var startNode = pool.OrderBy(x => MatchScore(x, userQuery) * rnd.NextDouble()).Last();
                proto.Points.Add(startNode);

                // Graph Walk: 근접한 노드 위주로 다음 목적지 선택 (공간적 일관성)
                for (int step = 0; step < rnd.Next(3, 6); step++)
                {
                    var last = proto.Points.Last();
                    var next = pool
                        .Where(p => !proto.Points.Any(existing => existing.Name == p.Name))
                        .OrderBy(p => GetDistance(last, p) * 0.7 - MatchScore(p, userQuery) * 0.3)
                        .FirstOrDefault();

                    if (next != null) proto.Points.Add(next);
                    else break;
                }

                CalculateScores(proto, userQuery);
                population.Add(proto);
            }

            // 3. Elite Evolutionary Cycle (Generation 2)
            for (int g = 0; g < 2; g++)
            {
                population = population.OrderByDescending(p => p.EfficiencyScore + p.DiversityScore + p.RelevanceScore).ToList();
                var elites = population.Take(3).ToList();

                // Crossover & Mutation
                var child = new Trajectory
                {
                    Region = region,
                    Points = elites[0].Points.Take(2).Concat(elites[1].Points.Skip(2).Take(2)).Distinct().ToList()
                };

                if (child.Points.Count > 0)
                {
                    CalculateScores(child, userQuery);
                    population.Add(child);
                }
            }

            return population.OrderByDescending(p => p.EfficiencyScore + p.DiversityScore + p.RelevanceScore).ToList();
        }

        private void BuildLocalGraph(List<TourismInfo> pool)
        {
            foreach (var poi in pool)
            {
                poi.Neighbors = pool
                    .Where(other => other.Name != poi.Name)
                    .Select(other => new { other.Name, Dist = GetDistance(poi, other) })
                    .OrderBy(x => x.Dist)
                    .Take(5)
                    .ToDictionary(x => x.Name, x => x.Dist);
            }
        }

        private double GetDistance(TourismInfo p1, TourismInfo p2)
        {
            return Math.Sqrt(Math.Pow(p1.Lat - p2.Lat, 2) + Math.Pow(p1.Lng - p2.Lng, 2));
        }

        private double MatchScore(TourismInfo poi, string query)
        {
            if (string.IsNullOrEmpty(query)) return 1.0;
            double score = 0.1;
            if (poi.Name.Contains(query)) score += 1.0;
            foreach (var tag in poi.Tags) if (query.Contains(tag)) score += 0.5;
            if (query.Contains(poi.Category)) score += 0.8;
            return score;
        }

        private void CalculateScores(Trajectory t, string query)
        {
            if (t.Points.Count < 2) { t.EfficiencyScore = 0; t.DiversityScore = 0; t.RelevanceScore = 0; return; }

            double totalDist = 0;
            for (int i = 0; i < t.Points.Count - 1; i++)
            {
                totalDist += GetDistance(t.Points[i], t.Points[i + 1]);
            }

            // 🚀 Spatial Efficiency: 이동 동선이 꼬이지 않고 짧을수록 높음
            t.EfficiencyScore = 2.0 / (totalDist + 0.1);

            // 🚀 Diversity: 다양한 카테고리 포함 여부
            t.DiversityScore = t.Points.Select(p => p.Category).Distinct().Count() * 0.5;

            // 🚀 Relevance: 사용자의 의도(Query)에 얼마나 부합하는가?
            t.RelevanceScore = t.Points.Sum(p => MatchScore(p, query));

            t.Reasoning = $"{t.Points.First().Category}에서 시작하여 동선을 최적화한 {t.Points.Count}곳의 코스입니다.";
        }

        public void PrunePerRegion(int limit)
        {
            Console.WriteLine($"[PRUNE] Enforcing per-region limit: {limit}");
            int removed = 0;
            foreach (var key in _cache.Keys.ToList())
            {
                if (_cache[key].Count > limit)
                {
                    int before = _cache[key].Count;
                    _cache[key] = _cache[key].Take(limit).ToList();
                    removed += (before - limit);
                }
            }
            if (removed > 0)
            {
                SaveCache();
                Console.WriteLine($"[PRUNE] Finished. Removed {removed} excess items across regions.");
            }
        }

        public void PruneGlobal(int limit)
        {
            int currentTotal = _cache.Values.Sum(v => v.Count);
            if (currentTotal <= limit) return;

            Console.WriteLine($"[PRUNE] Current total {currentTotal} exceeds limit {limit}. Pruning fairly...");

            int keysCount = _cache.Keys.Count;
            if (keysCount == 0) return;

            // 지역당 최소 보장 수량 (New regions or Okinawa preserved)
            int minPreserve = 200;

            foreach (var key in _cache.Keys.ToList())
            {
                if (_cache[key].Count > minPreserve)
                {
                    // 초과분 중 일부만 제거하여 서서히 맞춤
                    int excess = _cache[key].Count - minPreserve;
                    _cache[key] = _cache[key].Take(minPreserve + (excess / 2)).ToList();
                }
            }

            // 그래도 넘는다면 강제 조정
            currentTotal = _cache.Values.Sum(v => v.Count);
            if (currentTotal > limit)
            {
                int targetPerRegion = limit / keysCount;
                foreach (var key in _cache.Keys.ToList())
                {
                    if (_cache[key].Count > targetPerRegion)
                    {
                        _cache[key] = _cache[key].Take(targetPerRegion).ToList();
                    }
                }
            }

            SaveCache();
            Console.WriteLine($"[PRUNE] Balanced pruning done. Total: {_cache.Values.Sum(v => v.Count)} items.");
        }

        public async Task<string> GetOrFetchKnowledge(string region, int minimumItems = 10)
        {
            if (string.IsNullOrEmpty(region) || region.Length < 2) return "";
            if (_stopRequested) return "";

            if (_cache.ContainsKey(region) && _cache[region].Count >= minimumItems) return FormatKnowledge(region, _cache[region]);

            await Program.BroadcastServerLog($"Seeking coordinates for '{region}'...", region, "SYSTEM");
            Console.WriteLine($"[DYNAMIC GECODING] Seeking coordinates and info for '{region}' via Wikipedia API...");

            // 1. Wikipedia에서 지역 설명과 좌표를 한 번에 가져옴
            var (extract, lat, lng, isJapan) = await FetchLocationMetadata(region);

            var results = new List<TourismInfo>();

            // 1.1 기본 설명 추가
            if (!string.IsNullOrEmpty(extract))
            {
                foreach (var s in extract.Split('.').Take(5))
                {
                    if (string.IsNullOrWhiteSpace(s)) continue;
                    results.Add(new TourismInfo
                    {
                        Name = region,
                        Description = s.Trim(),
                        Tags = new List<string> { region, "Wiki" },
                        Lat = lat,
                        Lng = lng
                    });
                }
            }

            // 2. POI (명소) 스태킹: 좌표만 있으면 수행 (Wiki intro 없어도 무관)
            if (lat != 0 && lng != 0)
            {
                if (_stopRequested) return "";

                // 🚀 이미 해당 지역 데이터가 부족할 때만 스태킹
                if (!_cache.ContainsKey(region) || _cache[region].Count < minimumItems)
                {
                    await Program.BroadcastServerLog($"Stacking POIs around {region}...", region, "SYSTEM");
                    Console.WriteLine($"[POI STACKING] Localizing POIs around {region} ({lat}, {lng})...");
                    var osmData = await FetchPOIFromOverpass(region, lat, lng);
                    if (osmData.Count > 0)
                    {
                        results.AddRange(osmData);
                    }
                }
            }

            if (results.Count > 0)
            {
                if (!_cache.ContainsKey(region)) _cache[region] = new List<TourismInfo>();

                // 🚀 실시간 쿼터 제한 (1000개 초과 시 수집 중단 및 기존 데이터 다이어트)
                if (_cache[region].Count >= REGION_CAPACITY)
                {
                    Console.WriteLine($"[QUOTA] {region} already has {REGION_CAPACITY}+ items. Skipping additional stacking.");
                }
                else
                {
                    _cache[region].AddRange(results);
                    if (_cache[region].Count > REGION_CAPACITY) _cache[region] = _cache[region].Take(REGION_CAPACITY).ToList();
                    SaveCache();
                }
                await Program.BroadcastServerLog($"{region} knowledge stack completed.", region, "SYSTEM");
                Console.WriteLine($"[DYNAMIC] Stored {_cache[region].Count} items for {region}. Total Cached Regions: {_cache.Count}");
                return FormatKnowledge(region, _cache[region]);
            }
            return "";
        }

        private async Task<(string extract, double lat, double lng, bool isJapan)> FetchLocationMetadata(string region)
        {
            if (_stopRequested) return ("", 0, 0, false);
            try
            {
                string url = $"https://ko.wikipedia.org/w/api.php?action=query&prop=extracts|coordinates&exintro&explaintext&titles={Uri.EscapeDataString(region)}&format=json&redirects=1";
                var json = await _httpClient.GetStringAsync(url);
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("query", out var query) && query.TryGetProperty("pages", out var pages))
                {
                    foreach (var page in pages.EnumerateObject())
                    {
                        if (page.Value.TryGetProperty("pageid", out _))
                        {
                            string extract = page.Value.TryGetProperty("extract", out var e) ? e.GetString() ?? "" : "";
                            double lat = 0, lng = 0;
                            if (page.Value.TryGetProperty("coordinates", out var coords))
                            {
                                var c = coords.EnumerateArray().First();
                                lat = c.GetProperty("lat").GetDouble();
                                lng = c.GetProperty("lon").GetDouble();
                            }

                            // 🚀 [SMART FALLBACK] 좌표가 0이라면 주요 지역 좌표 맵에서 가져오기
                            if (lat == 0 || lng == 0)
                            {
                                if (FallbackCoords.ContainsKey(region))
                                {
                                    lat = FallbackCoords[region].Lat;
                                    lng = FallbackCoords[region].Lng;
                                    Console.WriteLine($"[WIKI FALLBACK] Applied base coordinates for {region}: ({lat}, {lng})");
                                }
                                else { Console.WriteLine($"[WIKI WARNING] No coordinates or fallback for {region}"); }
                            }
                            else { Console.WriteLine($"[WIKI] Found coordinates for {region}: ({lat}, {lng})"); }

                            return (extract, lat, lng, extract.Contains("일본"));
                        }
                    }
                }
                Console.WriteLine($"[WIKI] No coordinates found for {region}");
            }
            catch (Exception ex) { Console.WriteLine($"[WIKI ERROR] {region}: {ex.Message}"); }
            return ("", 0, 0, false);
        }

        private async Task<List<TourismInfo>> FetchFromWikipedia(string region)
        {
            // 🚀 [QUOTA GUARD] 일일 API 호출 제한 체크 (v11.7)
            CheckAndResetDailyQuota();
            if (_dailyApiCount >= MAX_DAILY_CALLS)
            {
                Console.WriteLine($"[QUOTA ALERT] Daily API limit ({MAX_DAILY_CALLS}) reached. Skip for safe!");
                return new List<TourismInfo>();
            }

            var results = new List<TourismInfo>();
            try
            {
                _dailyApiCount++;
                string url = $"https://ko.wikipedia.org/w/api.php?action=query&list=search&srsearch={region} 관광지&format=json&utf8=1";
                var resp = await _httpClient.GetStringAsync(url);
                using var doc = JsonDocument.Parse(resp);
                if (doc.RootElement.TryGetProperty("query", out var query) && query.TryGetProperty("search", out var search))
                {
                    foreach (var item in search.EnumerateArray())
                    {
                        string title = item.GetProperty("title").GetString() ?? "";
                        if (!string.IsNullOrEmpty(title))
                        {
                            results.Add(new TourismInfo { Name = title, Description = "Wikipedia 정보 기반 관광지", Tags = new List<string> { region, "Wiki" }, Lat = 0, Lng = 0 });
                        }
                    }
                }
            }
            catch (Exception ex) { Console.WriteLine($"[WIKI SEARCH ERROR] {region}: {ex.Message}"); }
            return results;
        }

        private async Task<List<TourismInfo>> FetchPOIFromOverpass(string city, double lat, double lng)
        {
            if (_stopRequested) return new List<TourismInfo>();
            // 🚀 [QUOTA GUARD] Overpass 호출도 제한 포함
            CheckAndResetDailyQuota();
            if (_dailyApiCount >= MAX_DAILY_CALLS) return new List<TourismInfo>();

            var results = new List<TourismInfo>();
            try
            {
                _dailyApiCount++;
                string query = $@"
                    [out:json][timeout:50];
                    (
                      node[""tourism""](around:30000,{lat},{lng});
                      way[""tourism""](around:30000,{lat},{lng});
                      node[""amenity""~""restaurant|cafe|bar""](around:30000,{lat},{lng});
                      way[""amenity""~""restaurant|cafe|bar""](around:30000,{lat},{lng});
                      nwr[""historic""](around:30000,{lat},{lng});
                      nwr[""leisure""=""park""](around:30000,{lat},{lng});
                    );
                    out center 500;";

                var content = new FormUrlEncodedContent(new[] { new KeyValuePair<string, string>("data", query) });
                var resp = await _httpClient.PostAsync("https://overpass-api.de/api/interpreter", content);
                var json = await resp.Content.ReadAsStringAsync();

                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("elements", out var elements))
                {
                    foreach (var elem in elements.EnumerateArray())
                    {
                        if (elem.TryGetProperty("tags", out var tags) && tags.TryGetProperty("name", out var name))
                        {
                            // nwr + out center 대응 (Node는 lat/lon, Way/Relation은 center.lat/center.lon)
                            double pLat = lat, pLng = lng;
                            if (elem.TryGetProperty("lat", out var la)) { pLat = la.GetDouble(); pLng = elem.GetProperty("lon").GetDouble(); }
                            else if (elem.TryGetProperty("center", out var center)) { pLat = center.GetProperty("lat").GetDouble(); pLng = center.GetProperty("lon").GetDouble(); }

                            string cat = tags.TryGetProperty("tourism", out var t) ? (t.GetString() ?? "poi") :
                                        tags.TryGetProperty("amenity", out var a) ? (a.GetString() ?? "poi") : "poi";

                            results.Add(new TourismInfo
                            {
                                Name = name.GetString() ?? "POI",
                                Description = tags.TryGetProperty("description", out var d) ? (d.GetString() ?? "") : $"{city}의 {cat} 정보입니다.",
                                Tags = new List<string> { city, cat, "AutoStack" },
                                Lat = pLat,
                                Lng = pLng,
                                Category = cat // 🚀 추가: 카테고리 정보 명시
                            });
                        }
                    }
                }
                Console.WriteLine($"[POI STACKING] {city}: Successfully stacked {results.Count} items.");
            }
            catch (Exception ex) { Console.WriteLine($"[POI ERROR] {city}: {ex.Message}"); }
            return results;
        }

        private string FormatKnowledge(string region, List<TourismInfo> info)
        {
            var sb = new StringBuilder();
            sb.AppendLine($"### [실시간 API 결합 지식: {region}]");
            foreach (var item in info.Take(15)) sb.AppendLine($"- {item.Name}: {item.Description}");
            return sb.ToString();
        }

        public List<TourismInfo> GetAllStackedKnowledge()
        {
            return _cache.Values.SelectMany(v => v).ToList();
        }

        public async Task SeedKnowledge()
        {
            _stopRequested = false; // 시작 시 초기화
            // 🚀 한일 주요 관광 도시 리스트 대폭 확장 (Full Stacking)
            string[] seedRegions = {
                "오키나와", "이시가키", "미야코지마", "나하시", "기노완", "우라소에", "나고",
                /*
                "이시가키", "미야코지마", "나하시", "기노완", "우라소에", "나고",
                "홋카이도", "서울", "부산", "제주도", "강릉", "경주", "인천", "대구", "대전", "광주", "울산", "수원", "전주", "여수", "속초", "춘천",
                "도쿄", "오사카", "교토", "삿포로", "후쿠오카", "나고야", "요코하마", "하코네", "나라", "고베", "히로시마",
                "센다이", "기타큐슈", "가나자와", "다카야마", "구마모토", "벳푸", "마쓰야마", "나가사키", "하코다테", "구라시키", "우지",
                "가마쿠라", "닛코", "카루이자와", "아사히카와", "시즈오카", "오카야마"
                */
            };

            Console.WriteLine($"[SEEDING] Starting massive knowledge stacking for {seedRegions.Length} regions...");

            foreach (var region in seedRegions)
            {
                if (_stopRequested)
                {
                    Console.WriteLine("[SEEDING] Stop requested during cold start.");
                    break;
                }
                await GetOrFetchKnowledge(region, 100); // 🚀 Ensure at least 100 items per region on cold start
            }
            Console.WriteLine("[SEEDING] Massive knowledge stacking process finished/stopped.");
        }

        public async Task SeedKnowledgeStreaming(WebSocket ws)
        {
            _stopRequested = false;
            string[] seedRegions = {
                "오키나와", 
                /*
                "이시가키", "미야코지마", "나하시", "기노완", "우라소에", "나고",
                "홋카이도", "서울", "부산", "제주도", "강릉", "경주", "인천", "속초", "전주", "광주", "대구", "대전", "여수", "춘천",
                "도쿄", "오사카", "교토", "삿포로", "후쿠오카", "나고야", "요코하마", "하코네", "나라", "고베", "히로시마", "센다이",
                "기타큐슈", "치바", "사카이", "하마마쓰", "구마모토", "사가미하라", "시즈오카", "오카야마", "가나자와", "다카야마", "벳푸",
                "마쓰야마", "나가사키", "하코다테", "가마쿠라", "닛코", "미야자키", "아오모리", "니가타", "토야마", "고치", "오이타"
                */
            };

            foreach (var region in seedRegions)
            {
                if (_stopRequested)
                {
                    Console.WriteLine("[STREAMING] Stop requested by user.");
                    break;
                }

                int currentTotal = _cache.Values.Sum(v => v.Count);
                if (currentTotal >= GLOBAL_CAPACITY)
                {
                    Console.WriteLine($"[STREAMING] Global capacity ({GLOBAL_CAPACITY}) reached. Stopping.");
                    break;
                }

                Console.WriteLine($"[STREAMING] Processing {region}...");
                await Program.BroadcastServerLog($"Streaming infusion for {region}...", region, "SYNC");
                await GetOrFetchKnowledge(region, 500); // 🚀 스트리밍 수혈은 더 깊게 (최대 500개 타겟)

                if (_cache.ContainsKey(region))
                {
                    var progressObj = new
                    {
                        type = "KNOWLEDGE_PROGRESS",
                        current = Array.IndexOf(seedRegions, region) + 1,
                        total = seedRegions.Length,
                        status = $"{region} 지식 정제 중..."
                    };
                    string pJson = JsonSerializer.Serialize(progressObj);
                    if (ws.State == WebSocketState.Open) { await ws.SendAsync(new ArraySegment<byte>(Encoding.UTF8.GetBytes(pJson)), WebSocketMessageType.Text, true, CancellationToken.None); }

                    var responseObj = new
                    {
                        type = "KNOWLEDGE_RESULT",
                        data = _cache[region],
                        status = $"{region} 수혈 완료!"
                    };
                    string json = System.Text.Json.JsonSerializer.Serialize(responseObj);
                    byte[] bytes = Encoding.UTF8.GetBytes(json);

                    if (ws.State == WebSocketState.Open)
                    {
                        await ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
                        Console.WriteLine($"[STREAMING] Sent {region} data to client.");
                    }
                }
                // 🚀 API 레이턴시 및 429 방지 위해 딜레이 상향
                await Task.Delay(2500);
            }
        }

        public void ClearRegionKnowledge(string region)
        {
            var keysToRemove = _cache.Keys.Where(k => k.Contains(region)).ToList();
            foreach (var key in keysToRemove)
            {
                _cache.Remove(key);
            }
            SaveCache();
            Console.WriteLine($"[ERASER] Completely wiped all knowledge for region: {region}");
        }

        public void RequestStop() => _stopRequested = true;

        private void LoadCache()
        {
            if (File.Exists(CachePath)) try
                {
                    _cache = JsonSerializer.Deserialize<Dictionary<string, List<TourismInfo>>>(File.ReadAllText(CachePath)) ?? new Dictionary<string, List<TourismInfo>>();
                    Console.WriteLine($"[CACHE] Loaded {_cache.Count} regions from {CachePath}");
                }
                catch (Exception ex) { Console.WriteLine($"[CACHE LOAD ERROR] {ex.Message}"); }
        }

        private void CheckAndResetDailyQuota()
        {
            if (DateTime.Now.Date > _lastApiReset)
            {
                _dailyApiCount = 0;
                _lastApiReset = DateTime.Now.Date;
                Console.WriteLine("[QUOTA] Daily API counter reset.");
            }
        }

        private void SaveCache()
        {
            try
            {
                var options = new JsonSerializerOptions
                {
                    WriteIndented = true,
                    Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
                };
                File.WriteAllText(CachePath, JsonSerializer.Serialize(_cache, options));
                Console.WriteLine($"[CACHE] Saved {_cache.Count} regions to {CachePath}");
            }
            catch (Exception ex) { Console.WriteLine($"[CACHE SAVE ERROR] {ex.Message}"); }
        }
    }
}
