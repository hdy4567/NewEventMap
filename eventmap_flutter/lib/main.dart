
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'utils/sync_service.dart';
import 'screens/map_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // MonitoringBridgeClient.connect();
  SyncService.instance.startSync();
  runApp(
    const ProviderScope(
      child: EventMapApp(),
    ),
  );
}

class EventMapApp extends StatelessWidget {
  const EventMapApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'EventMap2 - Global Festival Tracker',
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF1A1714), // Chocolate Charcoal
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF8B5E3C), // Cookie Bronze
          brightness: Brightness.dark,
          surface: const Color(0xFF2E2925), // Warm Slate
        ),
        textTheme: const TextTheme(
          bodyLarge: TextStyle(color: Color(0xFFF5EFEB)), // Cream Text
          bodyMedium: TextStyle(color: Color(0xFFA8A096)), // Cocoa Text
        ),
      ),
      home: const MapScreen(),
    );
  }
}
