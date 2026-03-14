import 'package:flutter_test/flutter_test.dart';
import 'package:eventmap_flutter/models/event_item.dart';
import 'package:eventmap_flutter/utils/map_optimization_engine.dart';
import 'package:supercluster/supercluster.dart';

void main() {
  group('MapOptimizationEngine Tests', () {
    late MapOptimizationEngine engine;
    final mockEvents = [
      EventItem(
        id: 1,
        title: "Test Event 1",
        lat: 37.5,
        lng: 127.0,
        country: "Korea",
        region: "Seoul",
        tags: ["test"],
        theme: "test",
        celeb: [],
        imageUrl: "",
        summary: "test",
        color: "#ff0000",
      ),
      EventItem(
        id: 2,
        title: "Test Event 2",
        lat: 35.0,
        lng: 129.0,
        country: "Korea",
        region: "Busan",
        tags: ["test"],
        theme: "test",
        celeb: [],
        imageUrl: "",
        summary: "test",
        color: "#00ff00",
      ),
    ];

    setUp(() {
      engine = MapOptimizationEngine();
    });

    test('initializeIndex should create an index', () async {
      await engine.initializeIndex(mockEvents);
      expect(engine.isIndexing, false);
      
      final elements = engine.getVisibleElements(120.0, 30.0, 130.0, 40.0, 10);
      expect(elements.isNotEmpty, true);
    });

    test('getVisibleElements should return correct points', () async {
      await engine.initializeIndex(mockEvents);
      
      // Seoul area
      final seoulArea = engine.getVisibleElements(126.9, 37.4, 127.1, 37.6, 15);
      expect(seoulArea.length, 1);
      expect(seoulArea.first, isA<LayerPoint<EventItem>>());
      expect((seoulArea.first as LayerPoint<EventItem>).originalPoint.id, 1);

      // Outside area
      final emptyArea = engine.getVisibleElements(100.0, 10.0, 110.0, 20.0, 10);
      expect(emptyArea.isEmpty, true);
    });

    test('clearIndex should reset the engine', () async {
      await engine.initializeIndex(mockEvents);
      engine.clearIndex();
      
      final elements = engine.getVisibleElements(120.0, 30.0, 130.0, 40.0, 10);
      expect(elements.isEmpty, true);
    });
  });
}
