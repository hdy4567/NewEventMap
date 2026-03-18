using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Net.WebSockets;
using System.Threading;
using System.Threading.Tasks;
using System.Linq;
using System.Text;
using MonitoringBridge.Server.Models;

namespace MonitoringBridge.Server.Services
{
    /**
     * 🚀 UniversalKnowledgeEngine (v2025.3.18 Refactored)
     * High-speed region-sharded knowledge storage.
     */
    public class DynamicKnowledgeLibrary
    {
        private List<TourismInfo> _masterStack = new List<TourismInfo>();
        private TrajectoryPlanningEngine _planner = new TrajectoryPlanningEngine();
        private readonly string _storageDir = "knowledge_shards";
        private readonly string _legacyFilePath = "global_knowledge_cache.json";
        private readonly SemaphoreSlim _ioLock = new SemaphoreSlim(1, 1);
        private bool _isStopping = false;

        public DynamicKnowledgeLibrary()
        {
            if (!Directory.Exists(_storageDir)) Directory.CreateDirectory(_storageDir);
        }

        public void RequestStop() => _isStopping = true;

        /**
         * 📦 [SHARDED] Load balanced knowledge from region files
         */
        public async Task SeedKnowledge()
        {
            await _ioLock.WaitAsync();
            try
            {
                _masterStack.Clear();
                // 1. Try legacy import first
                if (File.Exists(_legacyFilePath))
                {
                    Console.WriteLine("📦 [DB-UPGRADE] Importing legacy JSON cache...");
                    var legacy = JsonSerializer.Deserialize<List<TourismInfo>>(await File.ReadAllTextAsync(_legacyFilePath));
                    if (legacy != null) { 
                        _masterStack.AddRange(legacy); 
                        // Automatically shard it
                        foreach(var g in legacy.GroupBy(x => string.IsNullOrWhiteSpace(x.Category) ? "unknown" : x.Category)) {
                             await File.WriteAllTextAsync(Path.Combine(_storageDir, $"{g.Key}.json"), JsonSerializer.Serialize(g.ToList()));
                        }
                        File.Move(_legacyFilePath, _legacyFilePath + ".bak");
                    }
                }

                // 2. Load from shards
                foreach (var file in Directory.GetFiles(_storageDir, "*.json"))
                {
                    var shard = JsonSerializer.Deserialize<List<TourismInfo>>(await File.ReadAllTextAsync(file));
                    if (shard != null) _masterStack.AddRange(shard);
                }
                Console.WriteLine($"✅ [STORAGE] {_masterStack.Count} items loaded from sharded shards.");
            }
            catch (Exception ex) { Console.WriteLine($"[SEED ERROR] {ex.Message}"); }
            finally { _ioLock.Release(); }
        }

        public List<TourismInfo> GetAllStackedKnowledge() => _masterStack.ToList();

        /**
         * 📡 [STREAM] Real-time Knowledge Push
         */
        public async Task SeedKnowledgeStreaming(WebSocket ws)
        {
            _isStopping = false;
            Console.WriteLine("📡 [STREAMING] Knowledge Fill Started...");
            
            // 🚀 Grouped Seeders for optimization (v17.0)
            var cities = new string[] { "서울", "도쿄", "오사카", "경기도", "강원도", "제주도", "니가타", "홋카이도" };
            var fallbacks = new Dictionary<string, (double Lat, double Lng)> {
                { "서울", (37.5665, 126.9780) }, { "도쿄", (35.6762, 139.6503) }, 
                { "오사카", (34.6937, 135.5023) }, { "경기도", (37.2752, 127.0095) }
            };

            var external = new ExternalKnowledgeService(new HttpClient());

            foreach (var city in cities)
            {
                if (_isStopping) break;
                if (!external.IsQuotaAvailable) break;

                await Program.BroadcastServerLog($"⚡ Scanning Region: {city}...", city, "SYNC");
                var metadata = await external.FetchLocationMetadata(city, fallbacks);
                
                await external.FetchPOIFromOverpass(city, metadata.lat, metadata.lng, async (info) => {
                    if (_isStopping) return;
                    
                    // No duplication logic
                    if (_masterStack.Any(x => x.Name == info.Name && Math.Abs(x.Lat - info.Lat) < 0.001)) return;

                    _masterStack.Add(info);
                    await CommunicationService.SendJson(ws, new { type = "KNOWLEDGE_RESULT", data = new List<TourismInfo> { info } });
                    
                    // Throttling for UI responsiveness
                    await Task.Delay(50);
                });

                await SyncShards(); 
            }
            Console.WriteLine("✅ [STREAMING] Knowledge Fill Completed.");
        }

        public async Task SyncShards()
        {
            await _ioLock.WaitAsync();
            try {
                foreach(var g in _masterStack.GroupBy(x => string.IsNullOrWhiteSpace(x.Category) ? "unknown" : x.Category)) {
                     await File.WriteAllTextAsync(Path.Combine(_storageDir, $"{g.Key}.json"), JsonSerializer.Serialize(g.ToList()));
                }
            } finally { _ioLock.Release(); }
        }

        public void PruneKnowledge(int limit)
        {
            if (_masterStack.Count > limit) {
                _masterStack = _masterStack.Take(limit).ToList();
                _ = SyncShards(); 
            }
        }

        public List<Trajectory> EvolutionPlanning(string region, string query)
        {
            var pool = _masterStack.Where(x => x.Tags.Contains(region) || x.Category.Contains(region)).ToList();
            if (pool.Count == 0) pool = _masterStack.Take(20).ToList();
            return _planner.EvolutionPlanning(region, pool, query);
        }

        public async Task<string> GetOrFetchKnowledge(string region)
        {
             var pool = _masterStack.Where(x => x.Tags.Contains(region)).ToList();
             if (pool.Count > 0) return string.Join("\n", pool.Take(10).Select(p => $"- {p.Name}: {p.Description}"));
             return "관련된 주변 명소 정보가 부족합니다. 스캔을 시작해 주세요.";
        }

        public void ClearRegionKnowledge(string region)
        {
            _masterStack.RemoveAll(x => x.Tags.Contains(region) || x.Category == region);
            _ = SyncShards();
        }

        public void PruneGlobal(int limit)
        {
            if (_masterStack.Count > limit) {
                _masterStack = _masterStack.Take(limit).ToList();
                _ = SyncShards();
            }
        }
    }
}
