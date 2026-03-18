$Address = "ws://127.0.0.1:9091/"
$Client = New-Object System.Net.WebSockets.ClientWebSocket
$CTRef = New-Object System.Threading.CancellationTokenSource
$CT = $CTRef.Token

Write-Host "📡 Connecting to $Address..."
$ConnectTask = $Client.ConnectAsync($Address, $CT)
$ConnectTask.Wait()

if ($Client.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
    Write-Host "✅ Connected!"
    
    # Send KNOWLEDGE_FILL
    $Message = '{"type":"KNOWLEDGE_FILL"}'
    $Bytes = [System.Text.Encoding]::UTF8.GetBytes($Message)
    $SendTask = $Client.SendAsync((New-Object ArraySegment[Byte] -ArgumentList @($Bytes, 0, $Bytes.Length)), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $CT)
    $SendTask.Wait()
    Write-Host "📡 KNOWLEDGE_FILL Request Sent."

    # Receive Loop (3 messages)
    for ($i = 0; $i -lt 3; $i++) {
        $Buffer = New-Object Byte[] 10000
        $RecvTask = $Client.ReceiveAsync((New-Object ArraySegment[Byte] -ArgumentList @($Buffer, 0, $Buffer.Length)), $CT)
        $RecvTask.Wait()
        $Res = [System.Text.Encoding]::UTF8.GetString($Buffer, 0, $RecvTask.Result.Count)
        Write-Host "📩 Received: $Res"
    }

    $Client.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "", $CT).Wait()
    Write-Host "🏁 Test Finished."
}
