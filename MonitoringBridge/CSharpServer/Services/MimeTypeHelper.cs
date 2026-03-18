namespace MonitoringBridge.Server.Services
{
    public static class MimeTypeHelper
    {
        public static string GetMimeType(string extension) => extension.ToLower() switch
        {
            ".html" => "text/html; charset=utf-8",
            ".js" => "application/javascript",
            ".css" => "text/css",
            ".png" => "image/png",
            ".jpg" => "image/jpeg",
            ".gif" => "image/gif",
            ".svg" => "image/svg+xml",
            ".json" => "application/json",
            ".ico" => "image/x-icon",
            _ => "application/octet-stream"
        };
    }
}
