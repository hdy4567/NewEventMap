using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using LLama;
using LLama.Common;
using MonitoringBridge.Server.Models;

namespace MonitoringBridge.Server.Services
{
    /**
     * 🚀 LlamaService (v2025.3)
     * AI 모델의 로딩, 추론, 스트리밍 처리를 전담하는 지능 엔진 레이어입니다.
     */
    public class LlamaService : IDisposable
    {
        private LLamaWeights? _modelWeights;
        private LLamaContext? _aiContext;
        private InteractiveExecutor? _aiExecutor;
        private StatelessExecutor? _statelessExecutor;
        private readonly string _modelPath;

        public LlamaService(string modelPath)
        {
            _modelPath = modelPath;
        }

        public async Task EnsureModelExists()
        {
            if (File.Exists(_modelPath)) return;
            string? modelFolder = Path.GetDirectoryName(_modelPath);
            if (modelFolder != null && !Directory.Exists(modelFolder)) Directory.CreateDirectory(modelFolder);
            
            Console.WriteLine("🤖 AI 모델 다운로드 중...");
            using var client = new HttpClient();
            string url = "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf";
            try
            {
                using var response = await client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead);
                response.EnsureSuccessStatusCode();
                using var fileStream = new FileStream(_modelPath, FileMode.Create, FileAccess.Write, FileShare.None);
                await response.Content.CopyToAsync(fileStream);
            }
            catch (Exception ex) { Console.WriteLine($"Download Failed: {ex.Message}"); }
        }

        public void Initialize()
        {
            try
            {
                if (!File.Exists(_modelPath)) return;
                var parameters = new ModelParams(_modelPath) { ContextSize = 1024, GpuLayerCount = 0 };
                _modelWeights = LLamaWeights.LoadFromFile(parameters);
                _aiContext = _modelWeights.CreateContext(parameters);
                _aiExecutor = new InteractiveExecutor(_aiContext);
                _statelessExecutor = new StatelessExecutor(_modelWeights, parameters);
                Console.WriteLine("🧠 AI 엔진 초기화 완료 (Interactive & Stateless).");
            }
            catch (Exception ex) { Console.WriteLine($"AI Init Error: {ex.Message}"); }
        }

        public async IAsyncEnumerable<string> InferStreaming(string prompt, InferenceParams parameters)
        {
            if (_aiExecutor == null) yield break;
            await foreach (var token in _aiExecutor.InferAsync(prompt, parameters))
            {
                yield return token;
            }
        }

        public void Dispose()
        {
            _aiContext?.Dispose();
            _modelWeights?.Dispose();
        }

        public bool IsLoaded => _modelWeights != null;
    }
}
