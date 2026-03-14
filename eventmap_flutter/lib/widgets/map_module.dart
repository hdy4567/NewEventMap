
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supercluster/supercluster.dart';
import 'package:dart_geohash/dart_geohash.dart';

import '../repository/database_helper.dart';
import '../models/event_item.dart';
import '../models/context_packet.dart';
import '../utils/map_optimization_engine.dart';
import '../widgets/optimized_marker_layer.dart';
import '../utils/sync_service.dart';

// --- State Model ---

class MapState {
  final String currentCountry;
  final String currentSubFilter;
  final String searchQuery;
  final List<LayerElement<EventItem>> visibleElements;
  final Set<int> selectedIds;
  final Rect? selectionRect;
  final bool isIndexing;
  final bool isMapReady;
  final LatLng initialCenter;
  final double initialZoom;

  MapState({
    this.currentCountry = "Korea",
    this.currentSubFilter = "전체",
    this.searchQuery = "",
    this.visibleElements = const [],
    this.selectedIds = const {},
    this.selectionRect,
    this.isIndexing = false,
    this.isMapReady = false,
    this.initialCenter = const LatLng(37.5665, 126.9780),
    this.initialZoom = 11.0,
  });

  MapState copyWith({
    String? currentCountry,
    String? currentSubFilter,
    String? searchQuery,
    List<LayerElement<EventItem>>? visibleElements,
    Set<int>? selectedIds,
    Rect? selectionRect,
    bool? isIndexing,
    bool? isMapReady,
    LatLng? initialCenter,
    double? initialZoom,
  }) {
    return MapState(
      currentCountry: currentCountry ?? this.currentCountry,
      currentSubFilter: currentSubFilter ?? this.currentSubFilter,
      searchQuery: searchQuery ?? this.searchQuery,
      visibleElements: visibleElements ?? this.visibleElements,
      selectedIds: selectedIds ?? this.selectedIds,
      selectionRect: selectionRect, // Allow null
      isIndexing: isIndexing ?? this.isIndexing,
      isMapReady: isMapReady ?? this.isMapReady,
      initialCenter: initialCenter ?? this.initialCenter,
      initialZoom: initialZoom ?? this.initialZoom,
    );
  }
}

// --- Provider ---

class MapStateNotifier extends StateNotifier<MapState> {
  final MapOptimizationEngine _optEngine = MapOptimizationEngine();
  MapController? _mapController;

  MapStateNotifier() : super(MapState()) {
    _loadData();
  }

  void setMapController(MapController controller) {
    _mapController = controller;
  }

  Future<void> _loadData() async {
    state = state.copyWith(isIndexing: true);
    final events = await DatabaseHelper.instance.getAllEvents();
    final packets = await DatabaseHelper.instance.getAllContextPackets();
    
    List<EventItem> combined = [...events];
    combined.addAll(packets.map((p) => p.toEventItem()));

    // Filter based on current state
    final filtered = combined.where((e) {
      if (e.country != state.currentCountry) return false;
      
      if (state.currentSubFilter != "전체") {
        if (state.currentSubFilter.startsWith("@")) {
          if (!e.tags.any((t) => t.toLowerCase() == state.currentSubFilter.substring(1).toLowerCase())) {
            return false;
          }
        } else if (e.region != state.currentSubFilter) {
          return false;
        }
      }

      if (state.searchQuery.isNotEmpty) {
        final q = state.searchQuery.toLowerCase();
        if (q.startsWith("@")) {
          if (!e.tags.any((t) => t.toLowerCase().contains(q.substring(1)))) return false;
        } else {
          final match = e.title.toLowerCase().contains(q) || 
                        e.summary.toLowerCase().contains(q) || 
                        e.tags.any((t) => t.toLowerCase().contains(q));
          if (!match) return false;
        }
      }
      return true;
    }).toList();

    await _optEngine.initializeIndex(filtered);
    state = state.copyWith(isIndexing: false);
    updateVisibleElements();
  }

  void setCountry(String country) {
    state = state.copyWith(currentCountry: country, currentSubFilter: "전체", selectedIds: {});
    _loadData();
  }

  void setSubFilter(String filter) {
    state = state.copyWith(currentSubFilter: filter, selectedIds: {});
    _loadData();
  }

  void setSearchQuery(String query) {
    state = state.copyWith(searchQuery: query, selectedIds: {});
    _loadData();
  }

  void updateVisibleElements() {
    if (_mapController == null) return;
    final camera = _mapController!.camera;
    final bounds = camera.visibleBounds;
    final zoom = camera.zoom.round();

    final elements = _optEngine.getVisibleElements(
      bounds.west, bounds.south, bounds.east, bounds.north, zoom
    );
    state = state.copyWith(visibleElements: elements);
  }

  void setMapReady(bool ready) {
    state = state.copyWith(isMapReady: ready);
    if (ready) updateVisibleElements();
  }

  void handleTap(Offset localPos) {
    if (_mapController == null) return;
    final camera = _mapController!.camera;
    
    // Sensitivity: marker visual radius is ~14. 
    // Default ergonomic hit radius ~25. Increasing by 10% + more for "quality" -> 32.0
    const double hitRadius = 32.0; 

    EventItem? tappedItem;
    double minDistance = hitRadius;

    for (final el in state.visibleElements) {
      if (el is LayerPoint<EventItem>) {
        final pos = camera.getOffsetFromOrigin(LatLng(el.y, el.x));
        final distance = (pos - localPos).distance;
        if (distance < minDistance) {
          minDistance = distance;
          tappedItem = el.originalPoint;
        }
      } else if (el is LayerCluster<EventItem>) {
        final pos = camera.getOffsetFromOrigin(LatLng(el.y, el.x));
        if ((pos - localPos).distance < hitRadius) {
          // Zoom into cluster logic (Optional, but good for quality)
          _mapController!.move(LatLng(el.y, el.x), camera.zoom + 1);
          return;
        }
      }
    }

    if (tappedItem != null) {
      state = state.copyWith(selectedIds: {tappedItem.id});
    } else {
      clearSelection();
    }
  }

  void startSelection(Offset start) {
    state = state.copyWith(selectionRect: Rect.fromPoints(start, start));
  }

  void updateSelection(Offset current) {
    if (state.selectionRect == null) return;
    final newRect = Rect.fromPoints(state.selectionRect!.topLeft, current);
    state = state.copyWith(selectionRect: newRect);
    
    // Immediate selection feedback
    _performSelection(newRect);
  }

  void endSelection() {
    state = state.copyWith(selectionRect: null);
  }

  void _performSelection(Rect rect) {
    if (_mapController == null) return;
    final camera = _mapController!.camera;
    final Set<int> newIds = {};
    for (final el in state.visibleElements) {
       final latLng = LatLng(el.y, el.x);
       final pos = camera.getOffsetFromOrigin(latLng);
       if (rect.contains(pos)) {
         if (el is LayerPoint<EventItem>) newIds.add(el.originalPoint.id);
       }
    }
    if (newIds.isNotEmpty) {
      state = state.copyWith(selectedIds: {...state.selectedIds, ...newIds});
    }
  }

  void animatedMoveTo(LatLng dest, double zoom, TickerProvider vsync) {
    if (_mapController == null) return;
    
    final latTween = Tween<double>(begin: _mapController!.camera.center.latitude, end: dest.latitude);
    final lngTween = Tween<double>(begin: _mapController!.camera.center.longitude, end: dest.longitude);
    final zoomTween = Tween<double>(begin: _mapController!.camera.zoom, end: zoom);

    final controller = AnimationController(duration: const Duration(milliseconds: 1000), vsync: vsync);
    final animation = CurvedAnimation(parent: controller, curve: Curves.fastOutSlowIn);

    controller.addListener(() {
      _mapController!.move(LatLng(latTween.evaluate(animation), lngTween.evaluate(animation)), zoomTween.evaluate(animation));
    });

    animation.addStatusListener((status) {
      if (status == AnimationStatus.completed || status == AnimationStatus.dismissed) {
        controller.dispose();
      }
    });

    controller.forward();
  }

  void clearSelection() {
    state = state.copyWith(selectedIds: {});
  }

  Future<void> addMemoAtCenter() async {
    if (_mapController == null) return;
    final center = _mapController!.camera.center;
    final now = DateTime.now();
    final id = "memo_${now.millisecondsSinceEpoch}";
    final geoHasher = GeoHasher();
    
    final packet = ContextPacket(
      id: id,
      location: center,
      geohash: geoHasher.encode(center.longitude, center.latitude),
      timestamp: now,
      textHeader: "New Memo @${state.currentCountry}",
    );
    
    await DatabaseHelper.instance.saveContextPacket(packet);
    SyncService.instance.sendSignal("MEMO_CREATED", text: "New node at $center");
    _loadData();
  }

  Future<void> deleteSelected() async {
    if (state.selectedIds.isEmpty) return;
    // For now, only logical clear to demonstrate UI.
    // In production, you would call: await DatabaseHelper.instance.deleteItems(state.selectedIds)
    clearSelection();
    _loadData();
  }
}

final mapProvider = StateNotifierProvider<MapStateNotifier, MapState>((ref) => MapStateNotifier());

// --- UI Module ---

class MapModule extends ConsumerStatefulWidget {
  const MapModule({super.key});

  @override
  ConsumerState<MapModule> createState() => _MapModuleState();
}

class _MapModuleState extends ConsumerState<MapModule> {
  final MapController _mapController = MapController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(mapProvider.notifier).setMapController(_mapController);
    });
  }

  @override
  Widget build(BuildContext context) {
    final mapState = ref.watch(mapProvider);

    return Focus(
      autofocus: true,
      onKeyEvent: (node, event) {
        if (event is KeyDownEvent && event.logicalKey == LogicalKeyboardKey.escape) {
          ref.read(mapProvider.notifier).clearSelection();
          return KeyEventResult.handled;
        }
        return KeyEventResult.ignored;
      },
      child: Listener(
        onPointerSignal: (event) {
          if (event is PointerScrollEvent) {
            if (HardwareKeyboard.instance.isAltPressed || HardwareKeyboard.instance.isControlPressed) {
              final double zoomChange = event.scrollDelta.dy / -150.0;
              const factor = 3.0;
              final currentZoom = _mapController.camera.zoom;
              _mapController.move(_mapController.camera.center, currentZoom + (zoomChange * factor));
            }
          }
        },
        child: GestureDetector(
          onTapUp: (d) => ref.read(mapProvider.notifier).handleTap(d.localPosition),
          onLongPressStart: (d) {
            ref.read(mapProvider.notifier).startSelection(d.localPosition);
          },
          onLongPressMoveUpdate: (d) {
            ref.read(mapProvider.notifier).updateSelection(d.localPosition);
          },
          onLongPressEnd: (d) {
            ref.read(mapProvider.notifier).endSelection();
          },
          child: FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: mapState.initialCenter,
              initialZoom: mapState.initialZoom,
              interactionOptions: const InteractionOptions(
                flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
              ),
              onMapReady: () => ref.read(mapProvider.notifier).setMapReady(true),
              onPositionChanged: (p, hasGesture) => ref.read(mapProvider.notifier).updateVisibleElements(),
            ),
            children: [
              ColorFiltered(
                colorFilter: const ColorFilter.matrix([
                  -0.21, -1.28, -0.05, 0, 255,
                  -0.07, -1.13, -0.05, 0, 255,
                  -0.03, -0.32, -0.18, 0, 255,
                  0, 0, 0, 1, 0,
                ]),
                child: TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  subdomains: const ['a', 'b', 'c'],
                ),
              ),
              if (mapState.isMapReady)
                CustomPaint(
                  size: Size.infinite,
                  painter: OptimizedMarkerPainter(
                    elements: mapState.visibleElements,
                    camera: _mapController.camera,
                    selectedIds: mapState.selectedIds,
                    selectionRect: mapState.selectionRect,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
