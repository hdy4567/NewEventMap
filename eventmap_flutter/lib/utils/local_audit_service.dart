
import '../repository/database_helper.dart';
import 'local_ai_engine.dart';
import 'package:flutter/foundation.dart';
import 'dart:convert';

class LocalAuditService {
  static final LocalAuditService instance = LocalAuditService._();
  LocalAuditService._();

  bool _isAuditing = false;

  /// 🕵️ [ON-DEVICE AUDIT] Scans all local data and auto-labels missing info
  Future<void> runFullAudit() async {
    if (_isAuditing) return;
    _isAuditing = true;
    debugPrint("🚀 [ON-DEVICE AUDIT] Starting full data scan...");

    try {
      final db = await DatabaseHelper.instance.database;
      final batch = db.batch();

      // 1. Audit EventItems (Filter only unlabeled ones first)
      final events = await DatabaseHelper.instance.getAllEvents();
      final unlabeledEvents = events.where((ev) => ev.region.isEmpty || ev.region == "Global");
      
      int eventHealed = 0;
      for (var ev in unlabeledEvents) {
          final result = await LocalAiEngine.instance.label("${ev.title} ${ev.summary}");
          String? newRegion = result["suggestedRegion"];
          String? newCat = result["suggestedCategory"];

          if (newRegion != null || newCat != null) {
            List<String> tags = List.from(ev.tags);
            if (newCat != null && !tags.contains(newCat)) tags.add(newCat);
            
            batch.update('events', {
              'region': newRegion?.replaceFirst('@', '') ?? ev.region,
              'tags': jsonEncode(tags),
              'synced': 0 
            }, where: 'id = ?', whereArgs: [ev.id]);
            eventHealed++;
          }
      }

      // 2. Audit ContextPackets (Archives)
      final packets = await DatabaseHelper.instance.getAllContextPackets();
      int packetHealed = 0;
      for (var p in packets) {
        final text = p.textHeader ?? "";
        final result = await LocalAiEngine.instance.label(text);
        String? newRegion = result["suggestedRegion"];
        String? newCat = result["suggestedCategory"];

        if (newRegion != null || newCat != null) {
          Map<String, dynamic> metadata = p.extraMetadata != null ? Map.from(p.extraMetadata) : {};
          List<String> tags = List<String>.from(metadata['tags'] ?? []);
          
          bool changed = false;
          if (newRegion != null && !tags.contains(newRegion)) {
            tags.add(newRegion);
            changed = true;
          }
          if (newCat != null && !tags.contains(newCat)) {
            tags.add(newCat);
            changed = true;
          }

          if (changed) {
            metadata['tags'] = tags;
            batch.update('context_packets', {
              'extraMetadata': jsonEncode(metadata),
              'synced': 0
            }, where: 'id = ?', whereArgs: [p.id]);
            packetHealed++;
          }
        }
      }

      if (eventHealed > 0 || packetHealed > 0) {
        await batch.commit(noResult: true);
        debugPrint("✅ [ON-DEVICE AUDIT] Audit Finished. Healed: $eventHealed events, $packetHealed packets.");
      } else {
        debugPrint("ℹ️ [ON-DEVICE AUDIT] No data needs healing.");
      }
    } catch (e) {
      debugPrint("❌ [ON-DEVICE AUDIT] Error: $e");
    } finally {
      _isAuditing = false;
    }
  }
}
