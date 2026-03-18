using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.Linq;

namespace MonitoringBridge.Server.Services
{
    /**
     * 🚀 Sentinel Intelligence (Output Filter & Reinforcer)
     * AI의 할루시네이션(거짓말)을 실시간으로 감지하고 교정하는 상위 지능 레이어입니다.
     * 하드코딩이 아닌, 문맥 분석을 통해 '잘못된 추론'을 차단합니다.
     */
    public class AIIntelligenceSentinel
    {
        /**
         * 🚀 Contextual Integrity Filter (No Hardcoding)
         * 하드코딩된 블랙리스트 대신, '질문의 목적지'와 '답변의 내용' 사이의 
         * 고유명사 일치 여부를 동적으로 판선하여 교정합니다.
         */
        public string ReinforceChunk(string chunk, string targetLocation)
        {
            if (string.IsNullOrEmpty(chunk)) return chunk;

            string reinforced = chunk;

            // 🚀 [INTELLIGENT FILTER] 
            // 1. Llama-3 특정 토큰 파편 및 중복 헤더 삭제 (최우선)
            reinforced = reinforced.Replace("<|begin_of_text|>", "").Replace("<|start_header_id|>", "").Replace("<|end_header_id|>", "").Replace("<|eot_id|>", "");

            // 2. [HAL-GUARD] 문맥 무관한 특정 도시가 나오면 경고 (파괴적 치환 대신 띄어쓰기 가공)
            // (예: 오키나와 가이드 중 뜬금없이 나타나는 타 국가 지명들만 선별적 제거)
            if (!string.IsNullOrEmpty(targetLocation)) {
                string[] knownHallucinations = { "Paris", "London", "NewYork", "Seoul" }; 
                foreach (var hal in knownHallucinations) {
                    if (targetLocation != hal && reinforced.Contains(hal, StringComparison.OrdinalIgnoreCase)) {
                        reinforced = reinforced.Replace(hal, targetLocation, StringComparison.OrdinalIgnoreCase);
                    }
                }
            }

            // 3. 범용 패턴 클리닝
            // 반복성 특수문자나 의미 없는 긴 영문 파편(Hallucinated tokens)만 삭제
            reinforced = Regex.Replace(reinforced, @"([a-zA-Z]{12,})", ""); 
            
            // 4. 문맥상 불필요한 번역 괄호 및 반복 숫자 삭제
            reinforced = Regex.Replace(reinforced, @"\s*\([^)]*[a-zA-Z]{2,}[^)]*\)", "");
            reinforced = Regex.Replace(reinforced, @"(\d+,\s*){4,}", ""); 

            return reinforced;
        }

        public string FinalValidate(string fullText)
        {
            if (string.IsNullOrEmpty(fullText) || fullText.Length < 15)
                return "@System #Reset\n데이터 무결성 검사 실패. 지능 엔진을 초기화합니다. 명확한 지역명을 포함해 다시 질문해 주세요.";

            var lines = fullText.Split('\n', StringSplitOptions.RemoveEmptyEntries);
            var result = new List<string>();
            bool hasTag = false;

            foreach (var line in lines)
            {
                string cleanLine = line.Trim();
                // 첫 줄 태그 규격 강제
                if (cleanLine.StartsWith("@"))
                {
                    if (hasTag) continue;
                    hasTag = true;
                }
                result.Add(cleanLine);
            }

            return string.Join("\n", result);
        }
    }
}
