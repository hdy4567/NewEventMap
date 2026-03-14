using System;
using System.Drawing;
using System.Windows.Forms;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Concurrent;
using System.Collections.Generic;

namespace MonitoringBridge.UI
{
    public class MainForm : Form
    {
        private Panel pnlSignals = null!;
        private ListBox lbLogs = null!;
        private Label lblStatus = null!;
        private Label lblFlowDetail = null!;
        private Dictionary<string, SignalLight> _lights = null!;
        private ConcurrentQueue<string> _logQueue = new ConcurrentQueue<string>();
        private System.Windows.Forms.Timer _timer = null!;

        // Tracking metrics
        private int _totalItemsProcessed = 0;
        private DateTime _lastUpdate = DateTime.Now;

        public MainForm()
        {
            this.Text = "NewEventMap (Tourism Data) - SYNC & MAP MONITOR";
            this.Size = new Size(850, 650);
            this.BackColor = Color.FromArgb(10, 10, 15); // Deep Night Blue
            this.ForeColor = Color.White;
            this.Font = new Font("Pretendard", 10);

            InitializeComponents();
            StartServer();
        }

        private void InitializeComponents()
        {
            Label lblHeader = new Label
            {
                Text = "NEWEVENTMAP :: TOURISM DATA FLOW DIAGNOSTICS",
                Dock = DockStyle.Top,
                Height = 80,
                TextAlign = ContentAlignment.MiddleCenter,
                Font = new Font("Segoe UI Semibold", 22, FontStyle.Bold),
                ForeColor = Color.FromArgb(0, 255, 127) // Spring Green (Map Theme)
            };
            this.Controls.Add(lblHeader);

            pnlSignals = new Panel
            {
                Dock = DockStyle.Top,
                Height = 160,
                Padding = new Padding(25),
                BackColor = Color.FromArgb(20, 20, 30)
            };
            this.Controls.Add(pnlSignals);

            _lights = new Dictionary<string, SignalLight>();
            // Tourism Domain Sensors: Data Collect -> SQL/Sync Process -> Map Cluster Render
            string[] signals = { "API_SERVICE_PULL", "SQL_DIFF_MERGE", "MAP_CLUSTER_RENDER" };
            int x = 45;
            foreach (var sig in signals)
            {
                var light = new SignalLight(sig) { Location = new Point(x, 15) };
                pnlSignals.Controls.Add(light);
                _lights[sig] = light;
                x += 260;
            }

            Panel pnlDashboard = new Panel
            {
                Dock = DockStyle.Top,
                Height = 140,
                BackColor = Color.FromArgb(30, 30, 45),
                Padding = new Padding(20)
            };
            this.Controls.Add(pnlDashboard);

            lblStatus = new Label
            {
                Text = "Sync Thread: IDLE",
                Dock = DockStyle.Top,
                Height = 35,
                ForeColor = Color.FromArgb(0, 255, 127),
                Font = new Font("Consolas", 14, FontStyle.Bold)
            };
            pnlDashboard.Controls.Add(lblStatus);

            lblFlowDetail = new Label
            {
                Text = "Monitoring Tourism API & SQL Diff...",
                Dock = DockStyle.Fill,
                ForeColor = Color.WhiteSmoke,
                Font = new Font("Segoe UI", 12, FontStyle.Italic)
            };
            pnlDashboard.Controls.Add(lblFlowDetail);

            lbLogs = new ListBox
            {
                Dock = DockStyle.Fill,
                BackColor = Color.FromArgb(5, 5, 5),
                ForeColor = Color.FromArgb(127, 255, 0), // Chartreuse
                Font = new Font("Consolas", 9),
                BorderStyle = BorderStyle.None
            };
            this.Controls.Add(lbLogs);

            _timer = new System.Windows.Forms.Timer { Interval = 100 };
            _timer.Tick += (s, e) =>
            {
                ProcessLogs();
                UpdatePerformanceStats();
            };
            _timer.Start();

            Task.Run(() => ScanCycle());
        }

        private void UpdatePerformanceStats()
        {
            if ((DateTime.Now - _lastUpdate).TotalSeconds > 1)
            {
                _lastUpdate = DateTime.Now;
                // Periodic health check display can be added here
            }
        }

        private void ProcessLogs()
        {
            while (_logQueue.TryDequeue(out string log))
            {
                lbLogs.Items.Insert(0, log);
                if (lbLogs.Items.Count > 150) lbLogs.Items.RemoveAt(150);
            }
        }

        private async void StartServer()
        {
            try
            {
                var listener = new HttpListener();
                listener.Prefixes.Add("http://localhost:8080/");
                listener.Start();
                Log("Tourism Sync Monitor Online: ws://localhost:8080/");

                while (true)
                {
                    var context = await listener.GetContextAsync();
                    if (context.Request.IsWebSocketRequest)
                    {
                        ProcessWebSocket(context);
                    }
                }
            }
            catch (Exception ex) { Log("System Error: " + ex.Message); }
        }

        private async void ProcessWebSocket(HttpListenerContext context)
        {
            var wsContext = await context.AcceptWebSocketAsync(null);
            if (wsContext == null) return;
            var ws = wsContext.WebSocket;
            if (ws == null) return;
            Log("Tourism App Instance Authenticated.");

            byte[] buffer = new byte[4096];
            while (ws.State == WebSocketState.Open)
            {
                var result = await ws.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                if (result.MessageType == WebSocketMessageType.Text)
                {
                    string json = Encoding.UTF8.GetString(buffer, 0, result.Count).Trim();
                    HandleIncomingData(json);
                }
            }
            Log("App Link Terminated.");
        }

        private void HandleIncomingData(string msg)
        {
            try
            {
                if (msg.StartsWith("{"))
                {
                    var data = JsonDocument.Parse(msg).RootElement;
                    string signal = data.GetProperty("signal").GetString() ?? "IDLE";
                    string? payload = data.TryGetProperty("text", out var t) ? t.GetString() : null;
                    UpdateDiagnosticsUI(signal, payload);
                }
                else
                {
                    UpdateDiagnosticsUI(msg, null);
                }
            }
            catch { UpdateDiagnosticsUI(msg, null); }
        }

        private void UpdateDiagnosticsUI(string signal, string? payload)
        {
            if (_lights.ContainsKey(signal))
            {
                _lights[signal].Flash();
                _totalItemsProcessed++;

                string statusText = "";
                if (signal == "API_SERVICE_PULL") statusText = "Sync Thread: FETCHING_API";
                else if (signal == "SQL_DIFF_MERGE") statusText = "Sync Thread: WRITING_SQL (Diff Merge)";
                else if (signal == "MAP_CLUSTER_RENDER") statusText = "Sync Thread: RENDERING_MAP (Geohash)";

                this.Invoke((MethodInvoker)delegate
                {
                    lblStatus.Text = statusText;
                    if (payload != null) lblFlowDetail.Text = $"Source: {payload}";
                });

                Log($"[{signal}] Processing entry..." + (payload != null ? $" Data: {payload}" : ""));
            }
        }

        private void Log(string msg) => _logQueue.Enqueue($"{DateTime.Now:HH:mm:ss.fff} | {msg}");

        private async Task ScanCycle()
        {
            while (true)
            {
                foreach (var light in _lights.Values)
                {
                    if (light.IsTimedOut() && light.IsActive_Internal)
                    {
                        light.IsActive_Internal = false;
                        Log($"[ALERT] Link Stalled: {light.SignalName}");
                    }
                }
                await Task.Delay(500);
            }
        }
    }

    public class SignalLight : UserControl
    {
        public string SignalName { get; }
        public bool IsActive_Internal { get; set; } = false;
        private DateTime _lastEvent = DateTime.MinValue;

        public SignalLight(string name)
        {
            this.SignalName = name ?? "SENSOR";
            this.Size = new Size(180, 110);
            this.DoubleBuffered = true;
        }

        public void Flash()
        {
            _lastEvent = DateTime.Now;
            if (!IsActive_Internal)
            {
                IsActive_Internal = true;
                this.Invoke((MethodInvoker)delegate { this.Invalidate(); });
            }
        }

        public bool IsTimedOut() => (DateTime.Now - _lastEvent).TotalSeconds > 5.0;

        protected override void OnPaint(PaintEventArgs e)
        {
            e.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
            Color lampColor = IsActive_Internal ? Color.FromArgb(0, 255, 127) : Color.FromArgb(35, 35, 45);
            Color glowColor = IsActive_Internal ? Color.FromArgb(100, 0, 255, 127) : Color.Transparent;

            // Draw Glow
            if (IsActive_Internal)
            {
                for (int i = 0; i < 15; i++)
                {
                    using (var pen = new Pen(Color.FromArgb(20 - i, 0, 255, 127), i))
                    {
                        e.Graphics.DrawEllipse(pen, 55 - i / 2, 5 - i / 2, 70 + i, 70 + i);
                    }
                }
            }

            using (var brush = new System.Drawing.Drawing2D.LinearGradientBrush(new Rectangle(60, 10, 60, 60), lampColor, Color.Black, 45f))
            {
                e.Graphics.FillEllipse(brush, 60, 10, 60, 60);
            }

            using (var pen = new Pen(IsActive_Internal ? Color.White : Color.FromArgb(80, 80, 80), 2))
            {
                e.Graphics.DrawEllipse(pen, 60, 10, 60, 60);
            }

            StringFormat sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Far };
            e.Graphics.DrawString(SignalName, this.Font, Brushes.WhiteSmoke, this.DisplayRectangle, sf);
        }
    }

    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }
}
