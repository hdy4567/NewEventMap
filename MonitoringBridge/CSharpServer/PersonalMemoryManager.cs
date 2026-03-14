using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text;

namespace MonitoringBridge.Server
{
    /**
     * 🚀 PersonalMemoryManager (Keeper's Brain)
     * 사용자의 모든 메모와 사진 태그를 '나만의 지식'으로 변환하고 관리합니다.
     * 데이터가 쌓일수록 AI의 추론 능력이 비약적으로 상승하는 RAG 구조입니다.
     */
    public class PersonalMemoryManager
    {
        private static readonly string MemoryPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "user_memory.json");
        private List<MemoryFragment> _memories = new List<MemoryFragment>();
        private Dictionary<string, double> _tagWeights = new Dictionary<string, double>();
        private readonly object _lock = new object();

        public PersonalMemoryManager()
        {
            LoadMemory();
        }

        // 🚀 지능형 학습 (Learning): 새로운 데이터가 들어오면 기존 지식과 병합 및 성장
        public void Learn(string title, string content, List<string> tags)
        {
            var fragment = new MemoryFragment
            {
                Id = Guid.NewGuid().ToString(),
                Title = title,
                Content = content,
                Tags = tags,
                Timestamp = DateTime.Now
            };

            lock (_lock)
            {
                _memories.Add(fragment);
                
                // 태그 가중치 학습 (사용자가 자주 쓰는 태그가 AI의 주요 관심사가 됨)
                foreach (var tag in tags)
                {
                    if (!_tagWeights.ContainsKey(tag)) _tagWeights[tag] = 1.0;
                    else _tagWeights[tag] += 0.1;
                }

                // 실시간 저장 (성장 기록)
                SaveMemory();
            }
        }

        // 🚀 시맨틱 검색 (Retrieval): 질문과 가장 관련 있는 '사용자만의 추억' 추출
        public string GetRelevantContext(string query)
        {
            var q = query.ToLower();
            
            // 관련도 정렬 (제목/내용/태그 일치도 기반)
            var relevant = _memories
                .Select(m => new { 
                    Fragment = m, 
                    Score = CalculateRelevance(m, q) 
                })
                .Where(x => x.Score > 0)
                .OrderByDescending(x => x.Score)
                .Take(5) // 상위 5개의 추억만 추론 근거로 제시
                .ToList();

            if (relevant.Count == 0) return "사용자님의 로컬 환경에서 관련된 추억 기록을 찾지 못했습니다.";

            var sb = new StringBuilder();
            sb.AppendLine("### [사용자의 실제 추억 기록 (Inferred from Personal Memos)]");
            foreach (var r in relevant)
            {
                sb.AppendLine($"- 장소/제목: {r.Fragment.Title}");
                sb.AppendLine($"- 기록 내용: {r.Fragment.Content}");
                sb.AppendLine($"- 관련 태그: {string.Join(", ", r.Fragment.Tags)}");
                sb.AppendLine();
            }
            return sb.ToString();
        }

        private double CalculateRelevance(MemoryFragment m, string query)
        {
            double score = 0;
            if (m.Title.ToLower().Contains(query)) score += 5.0;
            if (m.Content.ToLower().Contains(query)) score += 3.0;
            foreach (var tag in m.Tags)
            {
                if (query.Contains(tag.ToLower().Replace("@", "").Replace("#", "")))
                {
                    score += 2.0 * _tagWeights.GetValueOrDefault(tag, 1.0);
                }
            }
            return score;
        }

        private void SaveMemory()
        {
            // Lock은 이미 Learn에서 잡고 들어오지만, 직접 호출될 때를 위해 한번 더 체크 (Reentrant Lock)
            lock (_lock)
            {
                try
                {
                    var options = new JsonSerializerOptions { WriteIndented = true };
                    var json = JsonSerializer.Serialize(_memories, options);
                    File.WriteAllText(MemoryPath, json, Encoding.UTF8);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Memory Save Error] {ex.Message}");
                }
            }
        }

        private void LoadMemory()
        {
            if (!File.Exists(MemoryPath)) return;
            try
            {
                var json = File.ReadAllText(MemoryPath, Encoding.UTF8);
                _memories = JsonSerializer.Deserialize<List<MemoryFragment>>(json) ?? new List<MemoryFragment>();
                
                // 가중치 재계산
                foreach (var m in _memories)
                {
                    foreach (var tag in m.Tags)
                    {
                        if (!_tagWeights.ContainsKey(tag)) _tagWeights[tag] = 1.0;
                        else _tagWeights[tag] += 0.1;
                    }
                }
            }
            catch { }
        }

        public string GetStatsText()
        {
            return $"총 {_memories.Count}개의 추억 조각이 누적되었으며, {_tagWeights.Count}개의 핵심 태그 지능이 형성되었습니다.";
        }
    }

    public class MemoryFragment
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public List<string> Tags { get; set; } = new List<string>();
        public DateTime Timestamp { get; set; }
    }
}
