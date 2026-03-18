using System;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Concurrent;
using System.IO;
using System.Diagnostics;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Runtime.InteropServices;
using MonitoringBridge.Server.Models;
using MonitoringBridge.Server.Services;

namespace MonitoringBridge.Server
{
    /**
     * 🚀 [CORE] MonitoringBridge Backend Engine (v2025.3.18)
     * High-speed WebSocket orchestration with modular services.
     */
    class Program
    {
        // --- SERVICES (DI-ready) ---
        public static MonitoringBridge.Server.Services.DynamicKnowledgeLibrary GlobalKnowledge = new MonitoringBridge.Server.Services.DynamicKnowledgeLibrary();
        private static LlamaService _llama = new LlamaService("models/llama.gguf");
        private static CommunicationService _comm;
        private static ExternalKnowledgeService _external;
        private static PersonalMemoryManager _memory = new PersonalMemoryManager();
        private static MoERouter _router = new MoERouter();
        private static AIIntelligenceSentinel _sentinel = new AIIntelligenceSentinel();

        private static string? _cachedBaseDir = null;
        public static List<WebSocket> ConnectedClients = new List<WebSocket>();
        private static readonly object _aiLock = new object();
        private static int _clientCount = 0;

        // Monitoring status
        public static ConcurrentDictionary<string, DateTime> LastUpdate = new ConcurrentDictionary<string, DateTime>();
        public static ConcurrentDictionary<string, bool> InputStatus = new ConcurrentDictionary<string, bool>();
        private static string _lastSelectionJson = "{\"status\":\"none\"}";

        static async Task Main(string[] args)
        {
            // 🔨 Bootstrap Services
            _external = new ExternalKnowledgeService(new HttpClient());
            _llama = new LlamaService("models/llama.gguf");
            _comm = new CommunicationService(GlobalKnowledge, _memory, _router, _sentinel, _llama);

            // 🚀 [PORT SEIZING] Ensure our backend port (9005) is clean
            KillProcessOnPort(AppConfig.Port);

            HttpListener listener = new HttpListener();
            listener.Prefixes.Add($"http://localhost:{AppConfig.Port}/");
            listener.Prefixes.Add($"http://127.0.0.1:{AppConfig.Port}/");
            
            try { 
                listener.Start(); 
                Console.WriteLine($"✅ Port {AppConfig.Port} Seized Successfully.");
                Console.WriteLine($"🌐 MonitoringBridge Active: http://localhost:{AppConfig.Port}/");
            }
            catch (Exception ex) { Console.WriteLine($"[FATAL] Error starting listener: {ex.Message}"); return; }

            // 🧠 Init AI (Streaming Ready)
            await _llama.EnsureModelExists();
            _llama.Initialize();

            // 📡 Seed Knowledge in background
            _ = Task.Run(async () => {
                try { await GlobalKnowledge.SeedKnowledge(); }
                catch (Exception ex) { Console.WriteLine($"[SEED ERROR] {ex.Message}"); }
            });

            _ = Task.Run(() => MonitoringLoop());

            // 🕸️ Event Loop
            while (true)
            {
                try
                {
                    HttpListenerContext context = await listener.GetContextAsync();
                    if (context.Request.IsWebSocketRequest)
                    {
                        _ = ProcessWebSocket(context);
                    }
                    else
                    {
                        _ = ServeStaticFile(context);
                    }
                }
                catch (Exception ex) { Console.WriteLine($"[LOOP ERROR] {ex.Message}"); }
            }
        }

        static async Task ProcessWebSocket(HttpListenerContext context)
        {
            HttpListenerWebSocketContext webSocketContext = await context.AcceptWebSocketAsync(null);
            WebSocket webSocket = webSocketContext.WebSocket;

            lock (_aiLock) { ConnectedClients.Add(webSocket); _clientCount++; }
            Console.WriteLine($"🔌 Client Connected. Total: {_clientCount}");

            try
            {
                byte[] buffer = new byte[8192];
                while (webSocket.State == WebSocketState.Open)
                {
                    var result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                    if (result.MessageType == WebSocketMessageType.Close) break;

                    string message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                    await _comm.HandleMessage(webSocket, message);
                }
            }
            catch (Exception ex) { Console.WriteLine($"[SOCKET ERROR] {ex.Message}"); }
            finally
            {
                lock (_aiLock) { ConnectedClients.Remove(webSocket); _clientCount--; }
                if (webSocket.State != WebSocketState.Closed) 
                    await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "", CancellationToken.None);
                context.Response.Close();
            }
        }

        static async Task ServeStaticFile(HttpListenerContext context)
        {
            try
            {
                if (context.Request.Url == null) return;
                string urlPath = context.Request.Url.LocalPath;

                // 🚀 [API-BRIDGE] Win32 Native FileDropList Injection (v1.4)
                if (urlPath == "/api/sync/local-export" && context.Request.HttpMethod == "POST")
                {
                    using (var reader = new StreamReader(context.Request.InputStream))
                    {
                        string json = await reader.ReadToEndAsync();
                        var items = JsonNode.Parse(json).AsArray();
                        
                        string exportDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Desktop), "Kuzmo_Exports");
                        if (!Directory.Exists(exportDir)) Directory.CreateDirectory(exportDir);
                        
                        var filePaths = new List<string>();
                        foreach (var item in items)
                        {
                            string rawTitle = (string)item["title"] ?? "Untitled";
                            string cleanTitle = string.Join("_", rawTitle.Split(Path.GetInvalidFileNameChars())).Trim();
                            string fileName = $"{cleanTitle}.md";
                            string fullPath = Path.Combine(exportDir, fileName);
                            File.WriteAllText(fullPath, (string)item["content"], Encoding.UTF8);
                            filePaths.Add(fullPath);
                        }

                        // 🎯 [TRUE-OS-CLIPBOARD-COPY] (v2025.3.18.4100)
                        // This injects CF_HDROP format into the Windows Clipboard
                        // making AI chats see these as actual file uploads (not text).
                        NativeClipboard.SetFileDropList(filePaths);

                        // 📡 [EXTENSION-SYNC] Cache for extension fetch
                        _lastSelectionJson = "{\"status\":\"ok\", \"items\": " + json + "}";

                        context.Response.ContentType = "application/json";
                        byte[] res = Encoding.UTF8.GetBytes("{\"status\":\"ok\", \"path\": \"" + exportDir.Replace("\\", "\\\\") + "\"}");
                        await context.Response.OutputStream.WriteAsync(res, 0, res.Length);
                        context.Response.Close();
                        return;
                    }
                }

                // 📡 [EXTENSION-API] Allow Extension to pull latest files
                if (urlPath == "/api/sync/status" && context.Request.HttpMethod == "GET")
                {
                    context.Response.Headers.Add("Access-Control-Allow-Origin", "*");
                    context.Response.ContentType = "application/json";
                    byte[] res = Encoding.UTF8.GetBytes(_lastSelectionJson);
                    await context.Response.OutputStream.WriteAsync(res, 0, res.Length);
                    context.Response.Close();
                    return;
                }
                if (urlPath == "/" || string.IsNullOrEmpty(urlPath)) urlPath = "/index.html";

                if (_cachedBaseDir == null) _cachedBaseDir = FindFrontendDir();
                if (_cachedBaseDir == null) { context.Response.StatusCode = 500; context.Response.Close(); return; }

                string filePath = Path.GetFullPath(Path.Combine(_cachedBaseDir, urlPath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar)));
                
                if (File.Exists(filePath))
                {
                    byte[] content = await File.ReadAllBytesAsync(filePath);
                    string extension = Path.GetExtension(filePath).ToLower();
                    context.Response.ContentType = MimeTypeHelper.GetMimeType(extension);

                    // 🚀 [VITE-SYNC] Inject Server Config into Frontend on-the-fly
                    if (extension == ".js" || extension == ".html") content = TransformContent(content);

                    context.Response.ContentLength64 = content.Length;
                    await context.Response.OutputStream.WriteAsync(content, 0, content.Length);
                }
                else { context.Response.StatusCode = 404; }
            }
            catch { context.Response.StatusCode = 500; }
            finally { context.Response.Close(); }
        }

        private static byte[] TransformContent(byte[] content)
        {
            string text = Encoding.UTF8.GetString(content);
            text = text.Replace("import.meta.env.VITE_GOOGLE_API_KEY", $"\"{AppConfig.GoogleApiKey}\"");
            text = text.Replace("import.meta.env.VITE_GOOGLE_CLIENT_ID", $"\"{AppConfig.GoogleClientId}\"");
            text = text.Replace("import.meta.env.VITE_GOOGLE_APP_ID", $"\"{AppConfig.GoogleAppId}\"");
            return Encoding.UTF8.GetBytes(text);
        }

        public static async Task BroadcastServerLog(string title, string region, string type = "SYSTEM")
        {
            var logPacket = new { type = "SERVER_LOG", title, region, logType = type, time = DateTime.Now.ToString("HH:mm:ss") };
            WebSocket[] clients;
            lock (_aiLock) { clients = ConnectedClients.ToArray(); }
            foreach (var client in clients) { await CommunicationService.SendJson(client, logPacket); }
        }

        static string? FindFrontendDir()
        {
            string current = AppContext.BaseDirectory;
            while (current != null)
            {
                string candidate = Path.Combine(current, "eventmap-platform", "frontend-web", "dist");
                if (Directory.Exists(candidate)) return candidate;
                candidate = Path.Combine(current, "eventmap-platform", "frontend-web");
                if (Directory.Exists(Path.Combine(candidate, "public"))) return candidate;
                current = Path.GetDirectoryName(current)!;
            }
            return null;
        }

        static void KillProcessOnPort(int port)
        {
            try
            {
                var process = new Process();
                process.StartInfo.FileName = "cmd.exe";
                process.StartInfo.Arguments = $"/c netstat -ano | findstr :{port}";
                process.StartInfo.RedirectStandardOutput = true;
                process.StartInfo.UseShellExecute = false;
                process.StartInfo.CreateNoWindow = true;
                process.Start();
                string output = process.StandardOutput.ReadToEnd();
                process.WaitForExit();
                if (string.IsNullOrWhiteSpace(output)) return;
                var lines = output.Split(new[] { "\n" }, StringSplitOptions.RemoveEmptyEntries);
                foreach (var line in lines)
                {
                    if (line.Contains("LISTENING"))
                    {
                        var parts = line.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                        var pid = parts.Last().Trim();
                        if (int.TryParse(pid, out int p) && p != Process.GetCurrentProcess().Id)
                        {
                            try { Process.GetProcessById(p).Kill(); } catch { }
                        }
                    }
                }
            } catch { }
        }

        static async Task MonitoringLoop()
        {
            while (true)
            {
                foreach (var point in LastUpdate.Keys)
                {
                    if ((DateTime.Now - LastUpdate[point]).TotalSeconds > 2.0) InputStatus[point] = false;
                }
                await Task.Delay(1000);
            }
        }
    }

    /**
     * 🛡️ [NATIVE-CLIPBOARD-ENGINE] (v2025.3.18.4000)
     * Direct Win32 API implementation for True File Copy (CF_HDROP).
     */
    public static class NativeClipboard
    {
        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool OpenClipboard(IntPtr hWndNewOwner);
        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool EmptyClipboard();
        [DllImport("user32.dll", SetLastError = true)]
        private static extern IntPtr SetClipboardData(uint uFormat, IntPtr hMem);
        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool CloseClipboard();
        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern IntPtr GlobalAlloc(uint uFlags, UIntPtr dwBytes);
        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern IntPtr GlobalLock(IntPtr hMem);
        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool GlobalUnlock(IntPtr hMem);
        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        private const uint CF_HDROP = 15;
        private const uint GMEM_MOVEABLE = 0x0002;
        private const uint GMEM_ZEROINIT = 0x0040;

        [StructLayout(LayoutKind.Sequential)]
        struct DROPFILES
        {
            public int pFiles; // Offset to start of file list
            public int x;      // Mouse drop point X
            public int y;      // Mouse drop point Y
            public int fNC;    // Non-client area flag
            public int fWide;  // 1 = Unicode, 0 = ANSI
        }

        public static void SetFileDropList(IEnumerable<string> filePaths)
        {
            var thread = new Thread(() =>
            {
                // Absolute path for debug log
                string logFile = @"c:\YOON\CSrepos\NewEventMap\MonitoringBridge\CSharpServer\server_debug.log";
                try
                {
                    IntPtr hWnd = GetForegroundWindow();
                    if (!OpenClipboard(hWnd)) hWnd = IntPtr.Zero; // Fallback
                    if (!OpenClipboard(hWnd)) return;

                    EmptyClipboard();

                    string files = string.Join("\0", filePaths) + "\0\0";
                    byte[] fileBytes = Encoding.Unicode.GetBytes(files);

                    int structSize = Marshal.SizeOf<DROPFILES>();
                    uint totalSize = (uint)(structSize + fileBytes.Length);

                    IntPtr hGlobal = GlobalAlloc(GMEM_MOVEABLE | GMEM_ZEROINIT, (UIntPtr)totalSize);
                    IntPtr pGlobal = GlobalLock(hGlobal);

                    DROPFILES df = new DROPFILES { pFiles = structSize, fWide = 1 };
                    Marshal.StructureToPtr(df, pGlobal, false);
                    Marshal.Copy(fileBytes, 0, (IntPtr)((long)pGlobal + structSize), fileBytes.Length);

                    GlobalUnlock(hGlobal);
                    SetClipboardData(CF_HDROP, hGlobal);
                    CloseClipboard();

                    File.AppendAllText(logFile, $"[{DateTime.Now}] [SUCCESS] Injected {filePaths.Count()} files. (Align: {structSize}B)\n");
                    Console.WriteLine($"🚀 [WIN32_SYNC] {filePaths.Count()} files injected.");
                }
                catch (Exception ex) 
                { 
                    File.AppendAllText(logFile, $"[{DateTime.Now}] [ERROR] {ex.Message}\n");
                    Console.WriteLine($"[NATIVE_CLIP_ERR] {ex.Message}");
                }
            });

            thread.SetApartmentState(ApartmentState.STA);
            thread.Start();
            thread.Join();
        }
    }
}
