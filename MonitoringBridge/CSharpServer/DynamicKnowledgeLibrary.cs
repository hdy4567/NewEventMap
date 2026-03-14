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

namespace MonitoringBridge.Server
{
    public class TourismInfo
    {
        public string Name { get; set; } = "";
        public string Description { get; set; } = "";
        public List<string> Tags { get; set; } = new List<string>();
        public double Lat { get; set; }
        public double Lng { get; set; }
    }

    /**
     * 🚀 UniversalKnowledgeEngine (Zero-Hardcoding Version)
     * 어떤 리스트나 좌표 하드코딩 없이, Wikipedia의 좌표(coordinates) 데이터를 기반으로 
     * 전 세계 어디든 실시간으로 지식을 수집하고 "쌓는" 시스템입니다.
     */
    public class DynamicKnowledgeLibrary
    {
        private static readonly string CachePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "global_knowledge_cache.json");
        private Dictionary<string, List<TourismInfo>> _cache = new Dictionary<string, List<TourismInfo>>();
        private readonly HttpClient _httpClient = new HttpClient();

        public DynamicKnowledgeLibrary() { LoadCache(); }

        public async Task<string> GetOrFetchKnowledge(string region)
        {
            if (string.IsNullOrEmpty(region) || region.Length < 2) return "";

            if (_cache.ContainsKey(region)) return FormatKnowledge(region, _cache[region]);

            Console.WriteLine($"[DYNAMIC GECODING] Seeking coordinates and info for '{region}' via Wikipedia API...");
            
            // 1. Wikipedia에서 지역 설명과 좌표를 한 번에 가져옴 (하드코딩 제거 핵심)
            var (extract, lat, lng, isJapan) = await FetchLocationMetadata(region);
            
            var results = new List<TourismInfo>();
            if (!string.IsNullOrEmpty(extract))
            {
                // 기본 설명 추가 (정확한 좌표 부여)
                foreach (var s in extract.Split('.').Take(5))
                {
                    if (string.IsNullOrWhiteSpace(s)) continue;
                    results.Add(new TourismInfo { 
                        Name = region, 
                        Description = s.Trim(), 
                        Tags = new List<string> { region, "Wiki" },
                        Lat = lat,
                        Lng = lng
                    });
                }

                // 2. 만약 좌표가 있고, 일본 지역으로 판별된다면 OSM Overpass로 주변 상세 명소 '스태킹'
                if (lat != 0 && lng != 0 && isJapan)
                {
                    Console.WriteLine($"[POI STACKING] Localizing Japanese POIs around ({lat}, {lng})...");
                    var osmData = await FetchJapanFromOverpass(region, lat, lng);
                    results.AddRange(osmData);
                }
            }

            if (results.Count > 0)
            {
                _cache[region] = results;
                SaveCache();
                return FormatKnowledge(region, results);
            }
            return "";
        }

        private async Task<(string extract, double lat, double lng, bool isJapan)> FetchLocationMetadata(string region)
        {
            try
            {
                // 🚀 Wikipedia prop=coordinates: 하드코딩 없이 좌표를 가져오는 마법
                string url = $"https://ko.wikipedia.org/w/api.php?action=query&prop=extracts|coordinates&exintro&explaintext&titles={region}&format=json";
                var json = await _httpClient.GetStringAsync(url);
                using var doc = JsonDocument.Parse(json);
                var pages = doc.RootElement.GetProperty("query").GetProperty("pages");
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
                        // 국가 판별도 하드코딩 리스트 대신 설명 문구에서 유추
                        bool isJapan = extract.Contains("일본") || extract.Contains("Japan");
                        return (extract, lat, lng, isJapan);
                    }
                }
            } catch { }
            return ("", 0, 0, false);
        }

        private async Task<List<TourismInfo>> FetchJapanFromOverpass(string city, double lat, double lng)
        {
            var results = new List<TourismInfo>();
            try
            {
                string query = $"[out:json][timeout:30];node[\"tourism\"](around:30000,{lat},{lng});out body 200;";
                var content = new FormUrlEncodedContent(new[] { new KeyValuePair<string, string>("data", query) });
                var resp = await _httpClient.PostAsync("https://overpass-api.de/api/interpreter", content);
                var json = await resp.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                foreach (var elem in doc.RootElement.GetProperty("elements").EnumerateArray())
                {
                    if (elem.TryGetProperty("tags", out var tags) && tags.TryGetProperty("name", out var name))
                    {
                        double pLat = elem.TryGetProperty("lat", out var la) ? la.GetDouble() : lat;
                        double pLng = elem.TryGetProperty("lon", out var lo) ? lo.GetDouble() : lng;

                        results.Add(new TourismInfo {
                            Name = name.GetString() ?? "POI",
                            Description = tags.TryGetProperty("description", out var d) ? d.GetString() ?? "" : $"{city}의 로컬 명소입니다.",
                            Tags = new List<string> { city, "OSM" },
                            Lat = pLat,
                            Lng = pLng
                        });
                    }
                }
            } catch { }
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
            var all = new List<TourismInfo>();
            foreach (var key in _cache.Keys)
            {
                // 지역당 최대 100개씩 추출하여 반환 (대량 데이터 보장)
                all.AddRange(_cache[key].Take(100)); 
            }
            return all;
        }

        public async Task SeedKnowledge()
        {
            // 🚀 한일 주요 관광 도시 리스트 대폭 확장 (Full Stacking)
            string[] seedRegions = { 
                "서울", "부산", "제주도", "강릉", "경주", "인천", "대구", "대전", "광주", "울산", "수원", "전주", "여수", "속초", "춘천",
                "Tokyo", "Osaka", "Kyoto", "Sapporo", "Fukuoka", "Okinawa", "Nagoya", "Hakone", "Nara", "Yokohama", 
                "Kobe", "Hiroshima", "Sendai", "Kanazawa", "Takayama", "Kumamoto", "Beppu", "Matsuyama", "Nagasaki"
            };
            
            Console.WriteLine($"[SEEDING] Starting massive knowledge stacking for {seedRegions.Length} regions...");
            
            foreach (var region in seedRegions)
            {
                if (!_cache.ContainsKey(region))
                {
                    await GetOrFetchKnowledge(region);
                }
            }
            Console.WriteLine("[SEEDING] Massive knowledge stacking completed.");
        }

        public async Task SeedKnowledgeStreaming(WebSocket ws)
        {
            string[] seedRegions = { 
                "서울", "부산", "제주도", "강원도", "강릉", "경주", "인천", "속초", "전주", "광주", "대구", "대전", "여수", "춘천",
                "도쿄", "오사카", "교토", "삿포로", "후쿠오카", "오키나와", "나고야", "요코하마", "하코네", "나라", "고베", "히로시마"
            };

            foreach (var region in seedRegions)
            {
                Console.WriteLine($"[STREAMING] Processing {region}...");
                await GetOrFetchKnowledge(region); // 내부에서 캐시 체크함
                
                if (_cache.ContainsKey(region))
                {
                    var progressObj = new { 
                        type = "KNOWLEDGE_PROGRESS", 
                        current = Array.IndexOf(seedRegions, region) + 1,
                        total = seedRegions.Length,
                        status = $"{region} 지식 정제 중..."
                    };
                    string pJson = JsonSerializer.Serialize(progressObj);
                    if (ws.State == WebSocketState.Open) { await ws.SendAsync(new ArraySegment<byte>(Encoding.UTF8.GetBytes(pJson)), WebSocketMessageType.Text, true, CancellationToken.None); }

                    var responseObj = new { 
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
                await Task.Delay(500); // 도스 공격 방지 및 안정성
            }
        }

        private void LoadCache() { if (File.Exists(CachePath)) try { _cache = JsonSerializer.Deserialize<Dictionary<string, List<TourismInfo>>>(File.ReadAllText(CachePath)) ?? new Dictionary<string, List<TourismInfo>>(); } catch { } }
        private void SaveCache() { File.WriteAllText(CachePath, JsonSerializer.Serialize(_cache, new JsonSerializerOptions { WriteIndented = true })); }
    }
}
