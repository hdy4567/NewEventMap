import 'dart:convert';
import 'package:sqflite_common/sqlite_api.dart';
import '../models/event_item.dart';
import 'mock_data.dart';
import 'package:dart_geohash/dart_geohash.dart';
import 'db_provider.dart';
import '../models/context_packet.dart';
import 'package:latlong2/latlong.dart';
import 'package:flutter/foundation.dart';
import '../utils/io_utils.dart';
import 'dart:async';

class DatabaseHelper {
  static final DatabaseHelper instance = DatabaseHelper._init();
  static Database? _database;

  DatabaseHelper._init();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await openPlatformDatabase('event_map_v2.db', onCreate: _createDB);
    return _database!;
  }

  Future<void> _createDB(dynamic db, int version) async {
    const idType = 'INTEGER PRIMARY KEY AUTOINCREMENT';
    const textType = 'TEXT NOT NULL';
    const doubleType = 'REAL NOT NULL';

    await db.execute('''
      CREATE TABLE events (
        id $idType,
        title $textType,
        lat $doubleType,
        lng $doubleType,
        geohash TEXT,
        country $textType,
        region $textType,
        tags $textType,
        theme $textType,
        celeb $textType,
        imageUrl $textType,
        summary $textType,
        color $textType,
        contents $textType,
        synced INTEGER DEFAULT 0
      )
    ''');

    await db.execute('''
      CREATE TABLE context_packets (
        id TEXT PRIMARY KEY,
        lat REAL,
        lng REAL,
        geohash TEXT,
        textHeader TEXT,
        memoryPaths TEXT,
        visualPaths TEXT,
        timestamp TEXT,
        extraMetadata TEXT,
        synced INTEGER DEFAULT 0
      )
    ''');

    await db.execute('CREATE INDEX idx_events_geohash ON events (geohash)');
    await db.execute('CREATE INDEX idx_packets_geohash ON context_packets (geohash)');
    await db.execute('CREATE INDEX idx_events_synced ON events (synced)');
    await db.execute('CREATE INDEX idx_packets_synced ON context_packets (synced)');

    // Seed Initial Mock Data
    final geoHasher = GeoHasher();
    for (var event in mockEvents) {
      if (event.country == "Memo") continue; // Skip memos in event table
      await db.insert('events', {
        'id': event.id,
        'title': event.title,
        'lat': event.lat,
        'lng': event.lng,
        'geohash': geoHasher.encode(event.lng, event.lat),
        'country': event.country,
        'region': event.region,
        'tags': jsonEncode(event.tags),
        'theme': event.theme,
        'celeb': jsonEncode(event.celeb),
        'imageUrl': event.imageUrl,
        'summary': event.summary,
        'color': event.color,
        'contents': jsonEncode(event.contents.map((e) => e.toJson()).toList()),
      });
    }

    // Seed Initial Context Packets (Archives)
    await db.insert('context_packets', {
      'id': 'mock_p1',
      'lat': 37.5665,
      'lng': 126.9780,
      'geohash': geoHasher.encode(126.9780, 37.5665),
      'textHeader': '첫 번째 서울 여행 기록',
      'memoryPaths': jsonEncode([]),
      'visualPaths': jsonEncode(['https://source.unsplash.com/800x600/?seoul,city']),
      'timestamp': DateTime.now().toIso8601String(),
      'extraMetadata': jsonEncode({'tags': ['@서울', '#도심']}),
    });

    await db.insert('context_packets', {
      'id': 'mock_p2',
      'lat': 35.6895,
      'lng': 139.6917,
      'geohash': geoHasher.encode(139.6917, 35.6895),
      'textHeader': 'Tokyo Shinjuku Memory',
      'memoryPaths': jsonEncode([]),
      'visualPaths': jsonEncode(['https://source.unsplash.com/800x600/?tokyo,shinjuku']),
      'timestamp': DateTime.now().subtract(const Duration(days: 1)).toIso8601String(),
      'extraMetadata': jsonEncode({'tags': ['@Tokyo', '#Travel']}),
    });
  }

  // --- Event Methods ---

  Future<List<EventItem>> getAllEvents() async {
    final db = await instance.database;
    final result = await db.query('events');
    return result.map((json) => EventItem.fromJson({
      ...json,
      'tags': jsonDecode(json['tags'] as String),
      'celeb': jsonDecode(json['celeb'] as String),
      'contents': jsonDecode(json['contents'] as String),
    })).toList();
  }

  Future<void> addTagToEvent(int id, String tag) async {
    final db = await instance.database;
    final res = await db.query('events', columns: ['tags'], where: 'id = ?', whereArgs: [id]);
    if (res.isNotEmpty) {
      List<String> tags = List<String>.from(jsonDecode(res.first['tags'] as String));
      if (!tags.contains(tag)) {
        tags.add(tag);
        await db.update('events', {'tags': jsonEncode(tags)}, where: 'id = ?', whereArgs: [id]);
      }
    }
  }

  // --- Context Packet Methods (Unified Storage) ---

  Future<void> saveContextPacket(ContextPacket packet) async {
    final db = await instance.database;
    await db.insert(
      'context_packets',
      {
        'id': packet.id,
        'lat': packet.location.latitude,
        'lng': packet.location.longitude,
        'geohash': packet.geohash,
        'textHeader': packet.textHeader,
        'memoryPaths': jsonEncode(packet.memoryPaths),
        'visualPaths': jsonEncode(packet.visualPaths),
        'timestamp': packet.timestamp.toIso8601String(),
        'extraMetadata': jsonEncode(packet.extraMetadata),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<ContextPacket>> getAllContextPackets() async {
    final db = await instance.database;
    final result = await db.query('context_packets', orderBy: 'timestamp DESC');
    return result.map((json) {
      try {
        return ContextPacket.fromJson({
          'id': json['id'] as String,
          'lat': (json['lat'] as num).toDouble(),
          'lng': (json['lng'] as num).toDouble(),
          'geohash': json['geohash'] as String?,
          'textHeader': json['textHeader'] as String?,
          'memoryPaths': jsonDecode(json['memoryPaths'] as String),
          'visualPaths': jsonDecode(json['visualPaths'] as String),
          'timestamp': json['timestamp'] as String,
          'extraMetadata': jsonDecode(json['extraMetadata'] as String),
        });
      } catch (e) {
        debugPrint("Error parsing packet: $e");
        return ContextPacket(
          id: json['id'] as String,
          location: LatLng((json['lat'] as num).toDouble(), (json['lng'] as num).toDouble()),
          geohash: json['geohash'] as String? ?? "",
          timestamp: DateTime.parse(json['timestamp'] as String),
        );
      }
    }).toList();
  }

  Future<List<String>> getUniqueTagsFromPackets() async {
    final packets = await getAllContextPackets();
    final Set<String> tags = {};
    for (var p in packets) {
      tags.addAll(p.tags);
    }
    return tags.toList();
  }

  Future<void> addTagToPacket(int negativeTimestamp, String tag) async {
    final db = await instance.database;
    final targetIso = DateTime.fromMillisecondsSinceEpoch(negativeTimestamp * -1).toIso8601String();
    
    // Use SQL to find the specific packet by timestamp
    final List<Map<String, dynamic>> results = await db.query(
      'context_packets', 
      where: 'timestamp = ?', 
      whereArgs: [targetIso]
    );
    
    if (results.isNotEmpty) {
      final id = results.first['id'];
      String header = results.first['textHeader'] as String? ?? "Memory";
      if (!header.contains("@$tag")) {
        header += " @$tag";
        await db.update('context_packets', {'textHeader': header}, where: 'id = ?', whereArgs: [id]);
      }
    }
  }

  // --- Capacity Management (On-Device v1.0) ---

  Future<void> pruneDataPerRegion({int limit = 1000}) async {
    final db = await instance.database;
    debugPrint("🚀 [ON-DEVICE PRUNE] Enforcing $limit limit per region...");

    // 1. Get counts per region
    final List<Map<String, dynamic>> regions = await db.rawQuery(
        'SELECT region, COUNT(*) as count FROM events GROUP BY region');

    int totalPruned = 0;
    for (var r in regions) {
      final String regionName = r['region'] ?? "Global";
      final int count = r['count'] as int;

      if (count > limit) {
        final int toRemove = count - limit;
        // Remove oldest entries for this region
        await db.execute('''
          DELETE FROM events 
          WHERE id IN (
            SELECT id FROM events 
            WHERE region = ? 
            ORDER BY id ASC 
            LIMIT ?
          )
        ''', [regionName, toRemove]);
        totalPruned += toRemove;
      }
    }

    if (totalPruned > 0) {
      debugPrint("✅ [ON-DEVICE PRUNE] Pruned $totalPruned excess items.");
    } else {
      debugPrint("ℹ️ [ON-DEVICE PRUNE] Everything is within limits.");
    }
  }

  /// Integrated Drop Logic: Merges close packets or creates new ones
  Future<void> processDroppedFilesBatch({
    required List<({String path, String name})> files,
    required LatLng mapCenter,
  }) async {
    final packets = await getAllContextPackets();
    
    // 1. Heavy logic in background Isolate
    final results = await compute(_heavyIndexingLogic, {
      'files': files.map((f) => {'path': f.path, 'name': f.name}).toList(),
      'packets': packets.map((p) => p.toJson()).toList(),
      'mapCenter': {'lat': mapCenter.latitude, 'lng': mapCenter.longitude},
    });

    // 2. Database writes back in main thread
    for (var packetJson in results as List) {
      final p = ContextPacket.fromJson(packetJson);
      await saveContextPacket(p);
    }

    if (!kIsWeb) unawaited(exportIndexJson());
  }

  static List<Map<String, dynamic>> _heavyIndexingLogic(Map<String, dynamic> data) {
    final List files = data['files'];
    final List packetsJson = data['packets'];
    final Map center = data['mapCenter'];
    final LatLng mapCenter = LatLng(center['lat'], center['lng']);
    
    final List<ContextPacket> packets = packetsJson.map((j) => ContextPacket.fromJson(j)).toList();
    final now = DateTime.now();
    final geoHasher = GeoHasher();
    const distance = Distance();

    Map<String, ContextPacket> updatedOrNew = {};

    for (var fData in files) {
      final String path = fData['path'];
      final String name = fData['name'];
      final ext = path.split('.').last.toLowerCase();
      final fileTags = RegExp(r"@(\w+)").allMatches(name).map((m) => m.group(1)!).toList();

      if (packets.any((p) => p.visualPaths.contains(path) || p.memoryPaths.contains(path))) continue;

      ContextPacket? target;
      for (var p in packets) {
        if (distance.as(LengthUnit.Meter, p.location, mapCenter) < 100) {
          target = p;
          break;
        }
      }
      if (target == null && fileTags.isNotEmpty) {
        for (var p in packets) {
          if (p.tags.any((t) => fileTags.contains(t))) {
            target = p;
            break;
          }
        }
      }

      final key = target?.id ?? "new_${now.millisecondsSinceEpoch}_${files.indexOf(fData)}";
      ContextPacket current = updatedOrNew[key] ?? target ?? ContextPacket(
        id: key.startsWith("new_") ? "pkt_${key.split('_')[1]}" : key,
        location: mapCenter,
        geohash: geoHasher.encode(mapCenter.longitude, mapCenter.latitude),
        timestamp: now,
      );

      List<String> memories = List.from(current.memoryPaths);
      List<String> visuals = List.from(current.visualPaths);
      String? text = current.textHeader;

      if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'mov'].contains(ext)) {
        if (!visuals.contains(path)) visuals.add(path);
      } else if (['mp3', 'wav', 'm4a', 'aac'].contains(ext)) {
        if (!memories.contains(path)) memories.add(path);
      } else if (['txt', 'md'].contains(ext)) {
        text = (text == null) ? name : "$text\n$name";
      }

      updatedOrNew[key] = ContextPacket(
        id: current.id,
        location: current.location,
        geohash: current.geohash,
        textHeader: text,
        memoryPaths: memories,
        visualPaths: visuals,
        timestamp: current.timestamp,
      );
    }
    return updatedOrNew.values.map((p) => p.toJson()).toList();
  }


  Future<ContextPacket?> processDroppedFile({
    required String filePath,
    required String fileName,
    required LatLng mapCenter,
  }) async {
    await processDroppedFilesBatch(files: [(path: filePath, name: fileName)], mapCenter: mapCenter);
    return null;
  }

  // --- index.json Portability & Cloud Sync Logic ---

  Future<dynamic> get _indexFile async {
    // Native 전용 로직
    try {
      if (kIsWeb) return null;
      final path = await getAppSupportPath();
      return IoFile('$path/index.json');
    } catch (_) {
      return null;
    }
  }

  /// Exports current context packets & events to index.json for Cloud Sync
  Future<void> exportIndexJson() async {
    if (kIsWeb) return; // Web 지원 안함
    try {
      final packets = await getAllContextPackets();
      // Events are excluded from direct Cloud Sync for now (as they are usually static assets from TourAPI)
      // but if user modified them (synced=0), we could include them.
      
      final Map<String, dynamic> index = {
        'version': '1.0',
        'exportDate': DateTime.now().toIso8601String(),
        'packets': packets.map((p) => p.toJson()).toList(),
      };

      final dynamic file = await _indexFile;
      if (file == null) return;
      await file.writeAsString(jsonEncode(index), flush: true);
      debugPrint("Portable index.json exported");
    } catch (e) {
      debugPrint("Index Export Error: $e");
    }
  }

  /// Rebuilds Local SQLite Cache from an external index.json
  Future<void> importIndexJson(String jsonString) async {
    try {
      final Map<String, dynamic> index = jsonDecode(jsonString);
      final List<dynamic> packetList = index['packets'] ?? [];

      for (var pJson in packetList) {
        final packet = ContextPacket.fromJson(pJson as Map<String, dynamic>);
        await saveContextPacket(packet);
        // Mark as synced since it's from current 'truth' (Cloud)
        final db = await database;
        await db.update('context_packets', {'synced': 1}, where: 'id = ?', whereArgs: [packet.id]);
      }
      debugPrint("Imported ${packetList.length} packets from index.json");
    } catch (e) {
      debugPrint("Index Import Error: $e");
    }
  }
}
