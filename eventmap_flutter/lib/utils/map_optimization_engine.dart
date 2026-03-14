import 'dart:async';
import 'package:supercluster/supercluster.dart';
import '../models/event_item.dart';
import 'package:flutter/foundation.dart'; // For compute

/// Performance optimization engine for large-scale map markers
/// Implements Supercluster and Isolate-based indexing with Request IDs
class MapOptimizationEngine {
  SuperclusterImmutable<EventItem>? _index;
  int _lastRequestId = 0; 
  bool _isIndexing = false;
  List<EventItem> _indexedEvents = [];

  bool get isIndexing => _isIndexing;

  void clearIndex() {
    _index = null;
    _lastRequestId++;
  }

  Future<void> initializeIndex(List<EventItem> events) async {
    final requestId = ++_lastRequestId;
    
    // 💡 Optimization: Don't re-index if data is the same
    if (_index != null && _indexedEvents.length == events.length) {
      bool changed = false;
      for (int i = 0; i < events.length; i++) {
        if (events[i].id != _indexedEvents[i].id) {
          changed = true;
          break;
        }
      }
      if (!changed) return; 
    }

    try {
      final index = await compute(_buildSupercluster, events);
      if (requestId == _lastRequestId) {
        _index = index;
        _indexedEvents = List.from(events);
      }
    } catch (e) {
      debugPrint("Indexing error: $e");
    } finally {
      if (requestId == _lastRequestId) {
        _isIndexing = false;
      }
    }
  }

  static SuperclusterImmutable<EventItem> _buildSupercluster(List<EventItem> events) {
    // 🚀 High-performance background indexing
    return SuperclusterImmutable<EventItem>(
      getX: (e) => e.lng,
      getY: (e) => e.lat,
      minPoints: 2,
      maxZoom: 20,
      radius: 80, // Increased sensitivity for visible clustering
      extent: 512,
      nodeSize: 64, // Optimal for memory vs speed
    )..load(events);
  }

  /// Viewport Virtualization & Throttling
  List<LayerElement<EventItem>> getVisibleElements(
    double minLng, 
    double minLat, 
    double maxLng, 
    double maxLat, 
    int zoom
  ) {
    if (_index == null) return [];
    
    // search() returns clusters and markers within the current view
    return _index!.search(minLng, minLat, maxLng, maxLat, zoom);
  }
}
