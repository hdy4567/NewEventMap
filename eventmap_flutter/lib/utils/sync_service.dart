import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../repository/database_helper.dart';
import '../models/context_packet.dart';
import 'package:flutter/foundation.dart';
import 'io_utils.dart';
import 'local_ai_engine.dart';
import 'local_audit_service.dart';

class SyncService {
  static final SyncService instance = SyncService._();
  SyncService._();

  WebSocketChannel? _channel;
  final ValueNotifier<bool> isConnectedNotifier = ValueNotifier<bool>(false);
  bool get isConnected => isConnectedNotifier.value;
  
  Timer? _syncTimer;
  Completer<String>? _aiCompleter;

  void startSync() {
    _connect();
    // 🕵️ [ON-DEVICE] Audit & Prune on startup
    LocalAuditService.instance.runFullAudit(); 
    DatabaseHelper.instance.pruneDataPerRegion(); 
    _syncTimer = Timer.periodic(const Duration(seconds: 10), (_) => _syncDirtyRecords());
  }

  void stopSync() {
    _syncTimer?.cancel();
    _channel?.sink.close();
  }

  void _connect() {
    try {
      // 🚀 C# 서버 포트(9091)와 동기화
      _channel = WebSocketChannel.connect(Uri.parse('ws://localhost:9091/'));
      isConnectedNotifier.value = true;
      _channel!.stream.listen(
        (message) => _handleRemoteUpdate(message),
        onDone: () {
          isConnectedNotifier.value = false;
          _reconnect();
        },
        onError: (e) {
          isConnectedNotifier.value = false;
          _reconnect();
        },
      );
    } catch (e) {
      isConnectedNotifier.value = false;
      _reconnect();
    }
  }

  void _reconnect() {
    Future.delayed(const Duration(seconds: 5), () {
      if (!isConnectedNotifier.value) _connect();
    });
  }

  Future<void> _syncDirtyRecords() async {
    if (!isConnectedNotifier.value) return;

    final db = await DatabaseHelper.instance.database;
    
    // 1. Sync Packets
    final packets = await db.query('context_packets', where: 'synced = 0');
    for (var p in packets) {
      _channel!.sink.add(jsonEncode({
        'type': 'SYNC_PACKET',
        'data': p,
      }));
    }

    // 2. Sync Events (User Created/Modified)
    final events = await db.query('events', where: 'synced = 0');
    for (var e in events) {
      _channel!.sink.add(jsonEncode({
        'type': 'SYNC_EVENT',
        'data': e,
      }));
    }

    if (packets.isNotEmpty || events.isNotEmpty) {
      sendSignal("STREAMS_SYNC", text: "Pushing ${packets.length + events.length} dirty records...");
    }

    // 3. Periodic index.json Cloud Backup (Virtualization)
    if (!kIsWeb) {
      await DatabaseHelper.instance.exportIndexJson();
      // On Web indexFile is a stub and writeAsString does nothing
      // We could add exists() to IoFile or just check null
      try {
        // Simple check for native/web
        final path = await getAppSupportPath();
        if (path.isNotEmpty) {
           // On native we could read it. But since we just exported, we know it exists if not failed.
           // However, let's keep it simple for now and only do this on native.
        }
      } catch (e) {
        debugPrint("Cloud backup skipped: $e");
      }
    }
  }


  Future<void> _handleRemoteUpdate(String message) async {
    try {
      final json = jsonDecode(message);
      final type = json['type'];
      final data = json['data'];

      final db = await DatabaseHelper.instance.database;

      if (type == 'SYNC_ACK') {
        final id = json['id'];
        final table = json['table'];
        await db.update(table, {'synced': 1}, where: 'id = ?', whereArgs: [id]);
      } else if (type == 'REMOTE_UPDATE_PACKET') {
        final packet = ContextPacket.fromJson(data);
        await DatabaseHelper.instance.saveContextPacket(packet);
        // Mark as synced since it came from remote
        await db.update('context_packets', {'synced': 1}, where: 'id = ?', whereArgs: [packet.id]);
      } else if (type == 'CLOUD_SYNC_PULL') {
        // Handle remote index update from other device
        final indexContent = data['index'];
        if (indexContent != null) {
          await DatabaseHelper.instance.importIndexJson(indexContent);
          sendSignal("STREAMS_SYNC", text: "Remote index synchronized via Cloud.");
        }
      } else if (type == 'AI_RESPONSE') {
        _aiCompleter?.complete(data);
      }
    } catch (e) {
      debugPrint("Sync Handle Error: $e");
    }
  }

  // 🚀 Integrated Monitoring Signal Logic
  void sendSignal(String signal, {String? text}) {
    if (!isConnectedNotifier.value || _channel == null) return;
    
    _channel!.sink.add(jsonEncode({
      'type': 'SIGNAL',
      'data': {
        'signal': signal,
        'text': text,
      }
    }));
  }

  Future<String> askAi(String text) async {
    // 1. 온디바이스 AI (Local Engine) 우선 시도 or 서버 연결 확인
    final localResult = await LocalAiEngine.instance.process(text);

    if (!isConnectedNotifier.value) {
      // 서버가 꺼져 있어도 온디바이스 엔진에서 추출한 태그로 응답
      return localResult; 
    }
    
    _aiCompleter = Completer<String>();
    _channel!.sink.add(jsonEncode({
      'type': 'AI_QUERY',
      'data': {'text': text},
    }));

    return _aiCompleter!.future.timeout(
      const Duration(seconds: 15), 
      onTimeout: () => localResult // 타임아웃 시 온디바이스 결과 반환
    );
  }
}
