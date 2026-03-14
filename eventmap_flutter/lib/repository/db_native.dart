import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

Future<Database> openPlatformDatabase(String filePath, {required Future<void> Function(Database, int) onCreate}) async {
  final dbPath = await getDatabasesPath();
  final path = join(dbPath, filePath);
  return await openDatabase(
    path, 
    version: 4, 
    onCreate: (db, v) => onCreate(db, v),
    onUpgrade: (db, old, v) async {
       if (old < 2) await db.execute('ALTER TABLE events ADD COLUMN geohash TEXT');
       if (old < 3) {
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
             extraMetadata TEXT
           )
         ''');
         await db.execute('CREATE INDEX idx_packets_geohash ON context_packets (geohash)');
       }
       if (old < 4) {
         await db.execute('ALTER TABLE events ADD COLUMN synced INTEGER DEFAULT 0');
         await db.execute('ALTER TABLE context_packets ADD COLUMN synced INTEGER DEFAULT 0');
       }
    }
  );
}
