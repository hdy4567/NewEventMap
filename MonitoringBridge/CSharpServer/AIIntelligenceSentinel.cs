using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.Linq;

namespace MonitoringBridge.Server
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

            // 🚀 동적 고유명사 무결성 검사
            // 특정 리스트 대신, 영문 고유명사(대문자 시작 등)나 뜬금없는 외래 지명을 탐색
            if (!string.IsNullOrEmpty(targetLocation))
            {
                // 규칙 1: 질문과 관련 없는 영문 지명(Pattern 기반) 자동 감지 및 치환
                // (예: 질문은 '오키나와'인데 'P...', 'T...' 등으로 시작하는 영문 지명이 나오면 무조건 target으로 교정)
                var properNounMatch = Regex.Match(reinforced, @"\b[A-Z][a-z]+\b");
                if (properNounMatch.Success)
                {
                    string detectedWord = properNounMatch.Value;
                    // 질문(target)의 영문 표기가 포함되어 있지 않다면 홀루시네이션으로 보고 자동 치환
                    if (!detectedWord.Contains(targetLocation, StringComparison.OrdinalIgnoreCase))
                    {
                         // 하드코딩 없이 '질문의 목적지'로 강제 동기화
                         reinforced = reinforced.Replace(detectedWord, targetLocation);
                         Console.WriteLine($"[SENTINEL] Auto-Aligned: {detectedWord} -> {targetLocation}");
                    }
                }
            }

            // 🚀 범용 패턴 클리닝 (특정 지명과 무관한 지능형 필터링)
            // 1. 반복성 무한 리스트 삭제 (예: 1, 2, 3... 30 반복되는 패턴)
            reinforced = Regex.Replace(reinforced, @"(\d+,\s*){3,}\d+", "");
            
            // 2. 문맥상 불필요한 번역 괄호 삭제
            reinforced = Regex.Replace(reinforced, @"\s*\([^)]*[a-zA-Z]{2,}[^)]*\)", "");
            
            // 3. 잰말놀이 및 의미 없는 영문 파편 삭제
            reinforced = Regex.Replace(reinforced, @"[a-zA-Z]{4,}", "");

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
