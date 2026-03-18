using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using MonitoringBridge.Server.Models;

namespace MonitoringBridge.Server.Services
{
    /**
     * 🚀 ExternalKnowledgeService (v2025.3)
     * Handles external API interactions (Wikipedia, Overpass OSM).
     */
    public class ExternalKnowledgeService
    {
        private readonly HttpClient _httpClient;
        private int _dailyApiCount = 0;
        private DateTime _lastApiReset = DateTime.Now.Date;
        private const int MAX_DAILY_CALLS = 10000;

        public ExternalKnowledgeService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public void CheckAndResetDailyQuota()
        {
            if (DateTime.Now.Date > _lastApiReset)
            {
                _dailyApiCount = 0;
                _lastApiReset = DateTime.Now.Date;
            }
        }

        public bool IsQuotaAvailable => _dailyApiCount < MAX_DAILY_CALLS;

        public async Task<(string extract, double lat, double lng, bool isJapan)> FetchLocationMetadata(string region, Dictionary<string, (double Lat, double Lng)> fallbacks)
        {
            try
            {
                CheckAndResetDailyQuota();
                _dailyApiCount++;

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

                            if (lat == 0 || lng == 0)
                            {
                                if (fallbacks.ContainsKey(region))
                                {
                                    lat = fallbacks[region].Lat;
                                    lng = fallbacks[region].Lng;
                                }
                            }

                            return (extract, lat, lng, extract.Contains("일본"));
                        }
                    }
                }
            }
            catch { }
            return ("", 0, 0, false);
        }

        public async Task<List<TourismInfo>> FetchPOIFromOverpass(string city, double lat, double lng, Func<TourismInfo, Task>? onItemFound = null)
        {
            CheckAndResetDailyQuota();
            if (!IsQuotaAvailable) return new List<TourismInfo>();

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
                            double pLat = lat, pLng = lng;
                            if (elem.TryGetProperty("lat", out var la)) { pLat = la.GetDouble(); pLng = elem.GetProperty("lon").GetDouble(); }
                            else if (elem.TryGetProperty("center", out var center)) { pLat = center.GetProperty("lat").GetDouble(); pLng = center.GetProperty("lon").GetDouble(); }

                            string cat = tags.TryGetProperty("tourism", out var t) ? (t.GetString() ?? "poi") :
                                        tags.TryGetProperty("amenity", out var a) ? (a.GetString() ?? "poi") : "poi";

                            var info = new TourismInfo
                            {
                                Name = name.GetString() ?? "POI",
                                Description = tags.TryGetProperty("description", out var d) ? (d.GetString() ?? "") : $"{city}의 {cat} 정보입니다.",
                                Tags = new List<string> { city, cat, "AutoStack" },
                                Lat = pLat,
                                Lng = pLng,
                                Category = cat
                            };
                            results.Add(info);
                            if (onItemFound != null) await onItemFound(info);
                        }
                    }
                }
            }
            catch { }
            return results;
        }
    }
}
