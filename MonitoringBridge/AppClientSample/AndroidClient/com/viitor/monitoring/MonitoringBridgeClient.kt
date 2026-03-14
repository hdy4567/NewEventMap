package com.viitor.monitoring

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import android.util.Log

/**
 * 📟 PLC Logic Bridge Client (Android Edition)
 * 앱의 주요 이벤트를 C# 모니터링 서버로 전송합니다.
 */
object MonitoringBridgeClient {
    private const val TAG = "MonitoringBridge"
    private const val SERVER_URL = "ws://10.0.2.2:8080" // PC Localhost (Android Emulator 기준)
    
    private var webSocket: WebSocket? = null
    private val client = OkHttpClient()

    /**
     * 서버 연결 시도
     */
    fun connect() {
        val request = Request.Builder().url(SERVER_URL).build()
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: okhttp3.Response) {
                Log.i(TAG, "✅ Connected to PLC Monitoring Server")
                sendSignal("APP_CONNECTED")
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: okhttp3.Response?) {
                Log.e(TAG, "❌ Connection Failed: ${t.message}")
            }
        })
    }

    /**
     * 신호 전송 (PLC 접점 트리거)
     */
    fun sendSignal(signal: String) {
        sendSignalWithText(signal, null)
    }

    /**
     * 신호와 텍스트(데이터) 함께 전송
     */
    fun sendSignalWithText(signal: String, text: String?) {
        val json = if (text != null) {
             "{\"signal\": \"$signal\", \"text\": \"${text.replace("\"", "\\\"")}\"}"
        } else {
             "{\"signal\": \"$signal\"}"
        }
        
        val success = webSocket?.send(json) ?: false
        if (!success) {
            Log.w(TAG, "⚠️ Not connected. Dropping signal: $signal")
        }
    }
}
