using System;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Concurrent;
using System.IO;
using LLama;
using LLama.Common;
using System.Net.Http;
using System.Text.RegularExpressions;
using System.Collections.Generic;
using System.Linq;

namespace MonitoringBridge.Server
{
    class Program
    {
        static ConcurrentDictionary<string, bool> InputStatus = new ConcurrentDictionary<string, bool>();
        static ConcurrentDictionary<string, DateTime> LastUpdate = new ConcurrentDictionary<string, DateTime>();
        static LLamaContext? _aiContext;
        static InteractiveExecutor? _aiExecutor;
        static StatelessExecutor? _statelessExecutor;
        static LLamaWeights? _modelWeights;
        static string ModelPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "models", "llama-3.2-1b-instruct.gguf");

        static PersonalMemoryManager _memory = new PersonalMemoryManager();
        static MoERouter _router = new MoERouter();
        static AIIntelligenceSentinel _sentinel = new AIIntelligenceSentinel();
        static DynamicKnowledgeLibrary _globalKnowledge = new DynamicKnowledgeLibrary();

        static int _clientCount = 0;
        static readonly object _aiLock = new object();

        static async Task Main(string[] args)
        {
            HttpListener listener = new HttpListener();
            listener.Prefixes.Add("http://localhost:9091/");
            listener.Prefixes.Add("http://127.0.0.1:9091/");
            try { listener.Start(); }
            catch (Exception ex) { Console.WriteLine($"Error starting listener: {ex.Message}"); return; }

            Console.WriteLine("=== [PLC Logic Bridge Server Started] ===");
            await EnsureModelExists();

            Console.WriteLine("Listening on ws://127.0.0.1:9091/");
            _ = Task.Run(() => MonitoringLoop());

            while (true)
            {
                HttpListenerContext context = await listener.GetContextAsync();
                if (context.Request.IsWebSocketRequest) { ProcessRequest(context); }
                else { context.Response.StatusCode = 400; context.Response.Close(); }
            }
        }

        static async void ProcessRequest(HttpListenerContext context)
        {
            HttpListenerWebSocketContext webSocketContext = await context.AcceptWebSocketAsync(null);
            WebSocket webSocket = webSocketContext.WebSocket;

            lock (_aiLock)
            {
                _clientCount++;
                if (_clientCount == 1 && _modelWeights == null) { InitializeAI(); }
            }

            byte[] buffer = new byte[1024 * 10];
            try
            {
                while (webSocket.State == WebSocketState.Open)
                {
                    var result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                    if (result.MessageType == WebSocketMessageType.Text)
                    {
                        string message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                        await HandleSyncMessage(webSocket, message);
                    }
                    else if (result.MessageType == WebSocketMessageType.Close) { break; }
                }
            }
            catch (Exception ex) { Console.WriteLine($"Socket Error: {ex.Message}"); }
            finally
            {
                lock (_aiLock)
                {
                    _clientCount--;
                    if (_clientCount <= 0) { _clientCount = 0; UnloadAI(); }
                }
                if (webSocket.State != WebSocketState.Closed)
                {
                    try { await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "", CancellationToken.None); } catch { }
                }
            }
        }

        static void UnloadAI()
        {
            _aiContext?.Dispose(); _aiContext = null; _aiExecutor = null; _statelessExecutor = null;
            _modelWeights?.Dispose(); _modelWeights = null;
            GC.Collect(); GC.WaitForPendingFinalizers();
        }

        static async Task HandleSyncMessage(WebSocket ws, string message)
        {
            try
            {
                using var doc = System.Text.Json.JsonDocument.Parse(message);
                var root = doc.RootElement;
                string? type = root.GetProperty("type").GetString();
                if (type == null) return;
                var data = root.TryGetProperty("data", out var d) ? d : default;

                if (type == "SYNC_PACKET" || type == "SYNC_EVENT")
                {
                    string? id = data.GetProperty("id").ValueKind == System.Text.Json.JsonValueKind.String
                                ? data.GetProperty("id").GetString()
                                : data.GetProperty("id").GetInt32().ToString();
                    if (id == null) return;

                    Console.WriteLine($"[SYNC IN] ID:{id} received.");
                    string ack = $"{{\"type\": \"SYNC_ACK\", \"id\": \"{id}\"}}";
                    await ws.SendAsync(new ArraySegment<byte>(Encoding.UTF8.GetBytes(ack)), WebSocketMessageType.Text, true, CancellationToken.None);

                    ProcessPlcLogic("DATA_FETCH");

                    try
                    {
                        string title = data.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "";
                        string content = data.TryGetProperty("content", out var c) ? c.GetString() ?? "" : "";
                        List<string> tags = new List<string>();
                        if (data.TryGetProperty("tags", out var tg) && tg.ValueKind == System.Text.Json.JsonValueKind.Array)
                        {
                            foreach (var item in tg.EnumerateArray()) tags.Add(item.GetString() ?? "");
                        }
                        if (!string.IsNullOrEmpty(title)) { _memory.Learn(title, content, tags); }
                    }
                    catch { }
                }
                else if (type == "AI_QUERY")
                {
                    string promptText = data.GetProperty("text").GetString() ?? "";
                    await ExecuteAiStreaming(ws, promptText);
                }
                else if (type == "KNOWLEDGE_REQUEST")
                {
                    var allKnowledge = _globalKnowledge.GetAllStackedKnowledge();
                    string jsonResponse = System.Text.Json.JsonSerializer.Serialize(new { type = "KNOWLEDGE_RESULT", data = allKnowledge });
                    await ws.SendAsync(new ArraySegment<byte>(Encoding.UTF8.GetBytes(jsonResponse)), WebSocketMessageType.Text, true, CancellationToken.None);
                }
                else if (type == "KNOWLEDGE_FILL")
                {
                    // 🚀 실시간 무한 수집 트리거 (스트리밍 방식 v7.1)
                    Console.WriteLine($"[KNOWLEDGE] Broad Stacking Triggered via API (Streaming) for client.");
                    _ = Task.Run(async () => { await _globalKnowledge.SeedKnowledgeStreaming(ws); });
                }
            }
            catch (Exception ex) { Console.WriteLine($"Sync Error: {ex.Message}"); }
        }

        static async Task ExecuteAiStreaming(WebSocket ws, string text)
        {
            if (_aiExecutor == null) return;
            var selectedExperts = _router.Route(text);
            var primaryExpert = selectedExperts[0];
            string personalContext = _memory.GetRelevantContext(text);
            string targetLocation = "";
            var match = Regex.Match(text, @"(?:@|#)?([가-힣]{2,5})(?:\s*(?:\d코스|박|일|여행|추천|맛집|가볼))");
            if (match.Success) targetLocation = match.Groups[1].Value;
            var globalContext = await _globalKnowledge.GetOrFetchKnowledge(targetLocation);

            string prompt = $@"<|begin_of_text|><|start_header_id|>system<|end_header_id|>
당신은 'EventMap' 전용 가이드입니다.
[사용자의 실제 메모 기록]
{personalContext}
[실시간 API 수집 지식]
{globalContext}
당신은 현재 {primaryExpert.Persona} 모드입니다.<|eot_id|><|start_header_id|>user<|end_header_id|>
{text}<|eot_id|><|start_header_id|>assistant<|end_header_id|>@";

            var inferenceParams = new InferenceParams() { MaxTokens = 600, AntiPrompts = new[] { "<|eot_id|>", "User:", "System:", "Assistant:" } };
            await ws.SendAsync(new ArraySegment<byte>(Encoding.UTF8.GetBytes("{\"type\":\"AI_STREAM_START\"}")), WebSocketMessageType.Text, true, CancellationToken.None);
            StringBuilder fullText = new StringBuilder();
            await foreach (var token in _aiExecutor.InferAsync(prompt, inferenceParams))
            {
                string cleanedToken = _sentinel.ReinforceChunk(token, targetLocation);
                fullText.Append(cleanedToken);
                string chunkJson = System.Text.Json.JsonSerializer.Serialize(new { type = "AI_STREAM_CHUNK", chunk = cleanedToken });
                await ws.SendAsync(new ArraySegment<byte>(Encoding.UTF8.GetBytes(chunkJson)), WebSocketMessageType.Text, true, CancellationToken.None);
            }
            string validatedResult = _sentinel.FinalValidate(fullText.ToString());
            string endJson = System.Text.Json.JsonSerializer.Serialize(new { type = "AI_STREAM_END", data = validatedResult });
            await ws.SendAsync(new ArraySegment<byte>(Encoding.UTF8.GetBytes(endJson)), WebSocketMessageType.Text, true, CancellationToken.None);
        }

        static void ProcessPlcLogic(string signal)
        {
            InputStatus[signal] = true; LastUpdate[signal] = DateTime.Now;
            Console.WriteLine($"[SIGNAL IN] {signal}");
        }

        static async Task MonitoringLoop()
        {
            while (true)
            {
                foreach (var point in LastUpdate.Keys)
                {
                    if ((DateTime.Now - LastUpdate[point]).TotalSeconds > 2.0 && InputStatus[point]) { InputStatus[point] = false; }
                }
                await Task.Delay(1000);
            }
        }

        static async Task EnsureModelExists()
        {
            if (File.Exists(ModelPath)) return;
            string? modelFolder = Path.GetDirectoryName(ModelPath);
            if (modelFolder != null && !Directory.Exists(modelFolder)) Directory.CreateDirectory(modelFolder);
            Console.WriteLine("🤖 AI 모델 다운로드 중...");
            using var client = new HttpClient();
            string url = "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf";
            try
            {
                using var response = await client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead);
                response.EnsureSuccessStatusCode();
                using var fileStream = new FileStream(ModelPath, FileMode.Create, FileAccess.Write, FileShare.None);
                await response.Content.CopyToAsync(fileStream);
            }
            catch (Exception ex) { Console.WriteLine($"Download Failed: {ex.Message}"); }
        }

        static void InitializeAI()
        {
            try
            {
                if (!File.Exists(ModelPath)) return;
                var parameters = new ModelParams(ModelPath) { ContextSize = 1024, GpuLayerCount = 0 };
                _modelWeights = LLamaWeights.LoadFromFile(parameters);
                _aiContext = _modelWeights.CreateContext(parameters);
                _aiExecutor = new InteractiveExecutor(_aiContext);
                Console.WriteLine("🧠 AI 엔진 초기화 완료.");
            }
            catch (Exception ex) { Console.WriteLine($"AI Init Error: {ex.Message}"); }
        }
    }
}
