using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using LLama.Common;
using MonitoringBridge.Server.Models;

namespace MonitoringBridge.Server.Services
{
    /**
     * 🚀 CommunicationService (v2025.3 Refactored)
     * WebSocket 메시지 라우팅 및 클라이언트 통신을 전담합니다.
     */
    public class CommunicationService
    {
        private readonly DynamicKnowledgeLibrary _knowledge;
        private readonly PersonalMemoryManager _memory;
        private readonly MoERouter _router;
        private readonly AIIntelligenceSentinel _sentinel;
        private readonly LlamaService _llama;

        public CommunicationService(
            DynamicKnowledgeLibrary knowledge, 
            PersonalMemoryManager memory, 
            MoERouter router, 
            AIIntelligenceSentinel sentinel,
            LlamaService llama)
        {
            _knowledge = knowledge;
            _memory = memory;
            _router = router;
            _sentinel = sentinel;
            _llama = llama;
        }

        public async Task HandleMessage(WebSocket ws, string message)
        {
            try
            {
                using var doc = JsonDocument.Parse(message);
                var root = doc.RootElement;
                string type = root.GetProperty("type").GetString() ?? "";
                var data = root.TryGetProperty("data", out var d) ? d : default;

                switch (type)
                {
                    case "KNOWLEDGE_REQUEST":
                        await SendKnowledgeChunks(ws);
                        break;
                    case "KNOWLEDGE_FILL":
                        _ = Task.Run(async () => { await _knowledge.SeedKnowledgeStreaming(ws); });
                        break;
                    case "CHAT_QUERY":
                    case "AI_CHAT_MESSAGE":
                        string query = root.TryGetProperty("data", out var d2) ? (d2.TryGetProperty("text", out var t2) ? t2.GetString() : "") : (root.TryGetProperty("text", out var rt2) ? rt2.GetString() : "");
                        string loc = ExtractTargetLocation(query ?? "");
                        await Program.BroadcastServerLog($"Processing AI Query for @{loc}...", loc, "AI");
                        await HandleAiRequest(ws, root, type);
                        break;
                    case "SYNC_PACKET":
                    case "SYNC_EVENT":
                        await HandleSyncEvent(ws, data);
                        break;
                    case "KNOWLEDGE_CLEAR":
                        HandleKnowledgeClear(ws, data);
                        break;
                    case "KNOWLEDGE_PRUNE":
                        HandleKnowledgePrune(ws, data);
                        break;
                    case "KNOWLEDGE_STOP":
                        _knowledge.RequestStop();
                        break;
                    case "SYSTEM_REBOOT":
                        Console.WriteLine("!!! [SYSTEM REBOOT] Shutdown process initiated...");
                        Environment.Exit(0);
                        break;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[COMM ERROR] {ex.Message}");
            }
        }

        private async Task SendKnowledgeChunks(WebSocket ws)
        {
            var allKnowledge = _knowledge.GetAllStackedKnowledge();
            int chunkSize = 100;
            for (int i = 0; i < allKnowledge.Count; i += chunkSize)
            {
                var chunk = allKnowledge.Skip(i).Take(chunkSize).ToList();
                await SendJson(ws, new { 
                    type = "KNOWLEDGE_RESULT", 
                    data = chunk, 
                    status = $"Loading... ({Math.Min(i + chunkSize, allKnowledge.Count)}/{allKnowledge.Count})" 
                });
                if (allKnowledge.Count > 500) await Task.Delay(30); 
            }
        }

        private async Task HandleAiRequest(WebSocket ws, JsonElement root, string type)
        {
             var data = root.TryGetProperty("data", out var d) ? d : default;
             string promptText = data.ValueKind != JsonValueKind.Undefined 
                ? (data.TryGetProperty("text", out var t) ? t.GetString() ?? "" : "")
                : (root.TryGetProperty("text", out var rt) ? rt.GetString() ?? "" : "");

            long requestId = root.TryGetProperty("requestId", out var rid) ? rid.GetInt64() : DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            
            await ExecuteAiStreaming(ws, promptText, requestId);
        }

        private async Task ExecuteAiStreaming(WebSocket ws, string text, long requestId)
        {
            if (!_llama.IsLoaded) return;
            
            var selectedExperts = _router.Route(text);
            var primaryExpert = selectedExperts[0];
            string personalContext = _memory.GetRelevantContext(text);
            
            string targetLocation = ExtractTargetLocation(text);
            var globalContext = await _knowledge.GetOrFetchKnowledge(targetLocation);
            
            string trajectoryContext = "";
            var trajectories = _knowledge.EvolutionPlanning(targetLocation, text);
            if (trajectories != null && trajectories.Any())
            {
                var best = trajectories[0];
                trajectoryContext = "\n[EvoRAG 최적화 추천 경로]\n" + 
                                   string.Join(" -> ", best.Points.Select(p => p.Name)) +
                                   $"\n(이유: {best.Reasoning})";
            }

            string prompt = GeneratePrompt(personalContext, globalContext, trajectoryContext, primaryExpert.Persona, text);
            var inferenceParams = new InferenceParams() { MaxTokens = 800, AntiPrompts = new List<string> { "<|eot_id|>", "User:", "System:", "Assistant:" } };
            
            await SendJson(ws, new { type = "AI_STREAM_START", requestId = requestId });
            
            StringBuilder fullText = new StringBuilder();
            await foreach (var token in _llama.InferStreaming(prompt, inferenceParams))
            {
                string cleanedToken = _sentinel.ReinforceChunk(token, targetLocation);
                fullText.Append(cleanedToken);
                await SendJson(ws, new { type = "AI_STREAM_CHUNK", chunk = cleanedToken, requestId = requestId });
            }
            
            string validatedResult = _sentinel.FinalValidate(fullText.ToString());
            await SendJson(ws, new { type = "AI_STREAM_END", data = validatedResult, requestId = requestId });
        }

        private string ExtractTargetLocation(string text)
        {
            var match = Regex.Match(text, @"(?:@|#)?([가-힣]{2,5})(?:\s*(?:\d코스|박|일|여행|추천|맛집|가볼))?");
            return match.Success ? match.Groups[1].Value : "오키나와";
        }

        private string GeneratePrompt(string personal, string global, string trajectory, string persona, string query)
        {
            return $@"<|begin_of_text|><|start_header_id|>system<|end_header_id|>
당신은 'EventMap' 전용 AI 플래너입니다.
[사용자 메모 기반 기억]
{personal}
[실시간 API 수집 지점]
{global}
{trajectory}

당신은 '{persona}' 전문가입니다.
대답을 하기 전, 반드시 <thinking> 태그 안에서 최적 동선을 검증하세요. 계획이 끝나면 사용자에게 친절하게 추천 결과를 출력하세요.<|eot_id|><|start_header_id|>user<|end_header_id|>
{query}<|eot_id|><|start_header_id|>assistant<|end_header_id|>@<thinking>
";
        }

        private async Task HandleSyncEvent(WebSocket ws, JsonElement data)
        {
             // ACK sending
             string id = data.GetProperty("id").ValueKind == JsonValueKind.String ? data.GetProperty("id").GetString()! : data.GetProperty("id").GetInt32().ToString();
             await SendJson(ws, new { type = "SYNC_ACK", id = id });

             string title = data.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "";
             string content = data.TryGetProperty("summary", out var s) ? s.GetString() ?? "" : (data.TryGetProperty("content", out var c) ? c.GetString() ?? "" : "");
             var tags = new List<string>();
             if (data.TryGetProperty("tags", out var tg) && tg.ValueKind == JsonValueKind.Array)
             {
                 foreach (var item in tg.EnumerateArray()) tags.Add(item.GetString() ?? "");
             }
             if (!string.IsNullOrEmpty(title)) _memory.Learn(title, content, tags);
        }

        private async void HandleKnowledgeClear(WebSocket ws, JsonElement data)
        {
            string region = data.TryGetProperty("region", out var r) ? r.GetString() ?? "" : "";
            if (!string.IsNullOrEmpty(region)) {
                _knowledge.ClearRegionKnowledge(region);
                await SendJson(ws, new { type = "KNOWLEDGE_CLEAR_ACK", region = region });
            }
        }

        private async void HandleKnowledgePrune(WebSocket ws, JsonElement data)
        {
            int limit = data.TryGetProperty("limit", out var l) ? l.GetInt32() : 1000;
            _knowledge.PruneGlobal(limit);
            var count = _knowledge.GetAllStackedKnowledge().Count;
            await SendJson(ws, new { type = "KNOWLEDGE_PRUNE_ACK", total = count });
        }

        public static async Task SendJson(WebSocket ws, object data)
        {
            if (ws.State != WebSocketState.Open) return;
            string json = JsonSerializer.Serialize(data, new JsonSerializerOptions { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping });
            byte[] bytes = Encoding.UTF8.GetBytes(json);
            await ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
        }
    }
}
