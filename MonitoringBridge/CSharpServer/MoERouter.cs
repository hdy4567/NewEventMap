using System;
using System.Collections.Generic;
using System.Linq;

namespace MonitoringBridge.Server
{
    /**
     * 🚀 GLaM-style MoE Router
     * 사용자의 입력을 분석하여 가장 적합한 '지능 전문가(Expert)'를 호출합니다.
     */
    public class MoERouter
    {
        public enum ExpertType { VoyagePlan, MemoryArchive, LocalCurator, Generalist }

        public class ExpertConfig
        {
            public ExpertType Type { get; set; }
            public string Persona { get; set; } = string.Empty;
            public List<string> FocusKeywords { get; set; } = new List<string>();
            public string Style { get; set; } = string.Empty;
        }

        private List<ExpertConfig> _experts = new List<ExpertConfig>();

        public MoERouter()
        {
            // 1. Voyage Plan Expert (여행 계획 전문가)
            _experts.Add(new ExpertConfig {
                Type = ExpertType.VoyagePlan,
                Persona = "베테랑 국제 여행 가이드이자 일정 설계자",
                FocusKeywords = new List<string> { "추천", "일정", "계획", "가볼만한", "코스", "여행지", "2박", "3일" },
                Style = "구체적인 타임라인과 이동 동선을 고려한 전문적인 일정표 형식"
            });

            // 2. Memory Archive Expert (사용자 추억 분석가)
            _experts.Add(new ExpertConfig {
                Type = ExpertType.MemoryArchive,
                Persona = "사용자의 모든 기록을 기억하는 충직한 기록관(Keeper)",
                FocusKeywords = new List<string> { "내가", "기록", "메모", "그때", "기억", "찾아줘", "예전에" },
                Style = "사용자의 과거 기록을 인용하며 공감과 추억을 불러일으키는 따뜻한 문체"
            });

            // 3. Local Curator Expert (로컬 장소 큐레이터)
            _experts.Add(new ExpertConfig {
                Type = ExpertType.LocalCurator,
                Persona = "현지인만 아는 숨은 명소와 맛집을 꿰고 있는 로컬 전문가",
                FocusKeywords = new List<string> { "맛집", "카페", "분위기", "숨은", "로컬", "근처", "어디야" },
                Style = "장소의 숨겨진 이야기와 실질적인 팁을 강조하는 감각적인 문체"
            });
        }

        // 🚀 Gating Mechanism: 질문에 따라 최적의 전문가를 선정
        public List<ExpertConfig> Route(string query)
        {
            var results = _experts
                .Select(e => new { Expert = e, Score = e.FocusKeywords.Count(k => query.Contains(k)) })
                .Where(x => x.Score > 0)
                .OrderByDescending(x => x.Score)
                .Select(x => x.Expert)
                .ToList();

            // 매칭되는 전문가가 없으면 Generalist(기본형) 반환
            if (results.Count == 0) return new List<ExpertConfig> { 
                new ExpertConfig { 
                    Type = ExpertType.Generalist, 
                    Persona = "친절한 AI 추억 비서", 
                    Style = "담백하고 명확한 정보 제공" 
                } 
            };

            return results;
        }
    }
}
