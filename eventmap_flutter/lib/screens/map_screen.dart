
import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:supercluster/supercluster.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:desktop_drop/desktop_drop.dart';

import '../models/event_item.dart';
import '../models/context_packet.dart';
import '../widgets/event_detail_sheet.dart';
import '../widgets/overlays.dart';
import '../utils/sync_service.dart';
import '../widgets/map_module.dart';
import '../repository/database_helper.dart';

class MapScreen extends ConsumerStatefulWidget {
  const MapScreen({super.key});

  @override
  ConsumerState<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends ConsumerState<MapScreen> with TickerProviderStateMixin {
  bool _isDraggingOver = false;
  bool _isAiSearchActive = false;
  List<String> _dynamicTags = [];
  Timer? _searchDebounce;

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    final tags = await DatabaseHelper.instance.getUniqueTagsFromPackets();
    if (mounted) {
      setState(() {
        _dynamicTags = tags;
      });
    }
  }

  void _onSearchQueryChanged(String query) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 350), () async {
      String finalQuery = query;

      if (_isAiSearchActive && query.trim().isNotEmpty && !query.startsWith("@") && !query.startsWith("#")) {
        SyncService.instance.sendSignal("AI_PROCESSING", text: "Analyzing query: $query");
        final aiResult = await SyncService.instance.askAi(
          "Convert this search query into a structured tag/location format (e.g., @서울 #역사) or just return keywords: $query"
        );
        if (aiResult != "Server Not Connected" && aiResult != "AI Timeout") {
          finalQuery = aiResult;
        }
      }

      ref.read(mapProvider.notifier).setSearchQuery(finalQuery);
      SyncService.instance.sendSignal("STREAMS_SEARCH", text: finalQuery);
    });
  }

  void _onAiQueryApply(String q) {
    final locMatch = RegExp(r"@(\w+)").firstMatch(q);
    final tagMatch = RegExp(r"#(\w+)").firstMatch(q);
    
    String? loc = locMatch?.group(1);
    String? tag = tagMatch?.group(1);

    if (loc != null) {
      ref.read(mapProvider.notifier).setSubFilter(loc);
    }
    if (tag != null) {
      ref.read(mapProvider.notifier).setSearchQuery("@$tag");
    } else if (loc == null) {
      ref.read(mapProvider.notifier).setSearchQuery(q);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF12100E), // Deep Mocha Charcoal
      body: DropTarget(
        onDragDone: _handleFileDrop,
        onDragEntered: (_) => setState(() => _isDraggingOver = true),
        onDragExited: (_) => setState(() => _isDraggingOver = false),
        child: Stack(
          children: [
            // --- Phase 1: Integrated Map Module ---
            const MapModule(),

            // --- Optimized Premium Overlays (Localized Rebuilds) ---
            Consumer(builder: (context, ref, _) {
              final mapState = ref.watch(mapProvider);
              return _buildGlassOverlay(
                top: 40, left: 20, right: 20,
                child: PremiumTopPanel(
                  onSearch: _onSearchQueryChanged,
                  isAiActive: _isAiSearchActive,
                  onAiToggle: (val) => setState(() => _isAiSearchActive = val),
                  currentCountry: mapState.currentCountry,
                  onCountrySelected: (c) => ref.read(mapProvider.notifier).setCountry(c),
                  currentSubFilter: mapState.currentSubFilter,
                  onSubFilterSelected: (s) => ref.read(mapProvider.notifier).setSubFilter(s),
                  onAddMemo: () => ref.read(mapProvider.notifier).addMemoAtCenter(),
                  dynamicTags: _dynamicTags,
                ),
              );
            }),

            Positioned(
              top: 55, right: 35,
              child: Row(children: [
                const SyncIndicator(),
                const SizedBox(width: 15),
                StorageOverlay(onTap: _showStorage),
              ]),
            ),

            Positioned(
              top: MediaQuery.of(context).size.height / 2 - 100, 
              right: 15, 
              child: const MacDockOverlay(),
            ),

            Positioned(
              bottom: 30, right: 25, 
              child: AIChatOverlay(onQueryApply: _onAiQueryApply),
            ),

            // --- Selection/Detail UI (Localized) ---
            Consumer(builder: (context, ref, _) {
              final mapState = ref.watch(mapProvider);
              final selectedItem = _getSelectedItem(mapState);
              
              return Stack(
                children: [
                  if (selectedItem != null)
                    Positioned(
                      bottom: 20, left: 15, right: 15,
                      child: EventDetailSheet(
                        item: selectedItem, 
                        onClose: () => ref.read(mapProvider.notifier).clearSelection()
                      )
                    ),
                  
                  if (mapState.selectedIds.isNotEmpty && selectedItem == null)
                    Positioned(
                      bottom: 100, left: 0, right: 0,
                      child: Center(child: _buildSelectionActionPanel(mapState)),
                    ),
                ],
              );
            }),

            if (_isDraggingOver) _buildDropHint(),
          ],
        ),
      ),
    );
  }

  Widget _buildSelectionActionPanel(MapState state) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(32),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          decoration: BoxDecoration(
            color: const Color(0xFF1E293B).withValues(alpha: 0.9),
            borderRadius: BorderRadius.circular(32),
            border: Border.all(color: Colors.white12, width: 1),
            boxShadow: [BoxShadow(color: Colors.black45, blurRadius: 20, spreadRadius: 2)],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                "${state.selectedIds.length} items selected",
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
              ),
              const SizedBox(width: 20),
              _buildActionIcon(Icons.delete_outline, "Delete", Colors.redAccent, () => ref.read(mapProvider.notifier).deleteSelected()),
              const SizedBox(width: 12),
              _buildActionIcon(Icons.share_outlined, "Share", Colors.blueAccent, () {}),
              const VerticalDivider(width: 24, indent: 8, endIndent: 8, color: Colors.white12),
              _buildActionIcon(Icons.close, "Cancel (ESC)", Colors.white70, () => ref.read(mapProvider.notifier).clearSelection()),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildActionIcon(IconData icon, String label, Color color, VoidCallback onTap) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          icon: Icon(icon, color: color, size: 22),
          onPressed: onTap,
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(),
        ),
        const SizedBox(height: 4),
        Text(label, style: TextStyle(color: color.withValues(alpha: 0.7), fontSize: 9, fontWeight: FontWeight.bold)),
      ],
    );
  }

  EventItem? _getSelectedItem(MapState state) {
    if (state.selectedIds.isEmpty) return null;
    // This is a bit tricky since visibleElements might not contain the selected item if it's off-screen now.
    // However, for simplicity, search in current visible elements or we'd need the full list.
    // Let's assume for now we want to show it.
    for (final el in state.visibleElements) {
      if (el is LayerPoint<EventItem> && state.selectedIds.contains(el.originalPoint.id)) {
        return el.originalPoint;
      }
    }
    return null;
  }

  Widget _buildGlassOverlay({required double top, required double left, required double right, required Widget child}) => Positioned(
    top: top, left: left, right: right,
    child: Container( // 🚀 Removed BackdropFilter from the interaction path to eliminate the "1-second lag"
      padding: const EdgeInsets.symmetric(vertical: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1C1A).withValues(alpha: 0.95), // Deep Solid/Semi-trans Cocoa
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFF8B5E3C).withValues(alpha: 0.3), width: 1),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.5), blurRadius: 30, offset: const Offset(0, 10))
        ],
      ),
      child: child,
    ),
  );

  Widget _buildDropHint() => Container(
    color: Colors.pink.withValues(alpha: 0.1),
    child: Center(
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Container(
            padding: const EdgeInsets.all(40),
            decoration: BoxDecoration(
              color: const Color(0xFF1A1714).withValues(alpha: 0.9), // Deep Cocoa
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFD2B48C), width: 2), // Tan
            ),
            child: const Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.add_to_photos_rounded, size: 70, color: Color(0xFFD2B48C)), // Tan
                SizedBox(height: 18),
                Text("Drop to Save Context", style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
              ],
            ),
          ),
        ),
      ),
    ),
  );

  void _handleFileDrop(DropDoneDetails details) async {
    setState(() => _isDraggingOver = false);
    
    // Obtain the current map center from the provider/controller
    final mapCenter = ref.read(mapProvider).initialCenter; // Fallback or current center handled in MapModule
    
    // Convert files for batch processing
    final files = details.files.map((f) => (path: f.path, name: f.name)).toList();
    
    SyncService.instance.sendSignal("STREAMS_POST", text: "Processing ${files.length} dropped files...");
    
    await DatabaseHelper.instance.processDroppedFilesBatch(
      files: files, 
      mapCenter: mapCenter, 
    );
    
    // Notify provider to reload data
    ref.read(mapProvider.notifier).setSearchQuery(ref.read(mapProvider).searchQuery);
  }

  void _showStorage() {
    showModalBottomSheet(
      context: context, 
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => _buildStorageSheet(),
    );
  }

  Widget _buildStorageSheet() => DraggableScrollableSheet(
    initialChildSize: 0.75,
    maxChildSize: 0.95,
    builder: (_, controller) => Container(
      decoration: const BoxDecoration(
        color: Color(0xFF1A1714), // Deep Cocoa
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 12),
          Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2))),
          Padding(
            padding: const EdgeInsets.all(24),
            child: const Text("보관함 (Archives)", style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900, letterSpacing: -0.5)),
          ),
          Expanded(child: _buildStorageList(controller)),
        ],
      ),
    ),
  );

  Widget _buildStorageList(ScrollController sc) => FutureBuilder<List<ContextPacket>>(
    future: DatabaseHelper.instance.getAllContextPackets().timeout(const Duration(seconds: 1)),
    builder: (ctx, snap) {
      if (snap.hasError) return const Center(child: Text("보관함 접근 실패 (DB Error)", style: TextStyle(color: Colors.white24)));
      if (!snap.hasData) return const Center(child: CircularProgressIndicator());
      final mapState = ref.read(mapProvider);
      final filtered = snap.data!.where((p) => (p.textHeader ?? "").contains(mapState.searchQuery)).toList();
      return ListView.builder(
        controller: sc,
        itemCount: filtered.length,
        itemBuilder: (ctx, i) {
          final p = filtered[i];
          return ListTile(
            leading: const Icon(Icons.description_outlined, color: Colors.blueGrey),
            title: Text(p.textHeader ?? "Memory Item", style: const TextStyle(color: Colors.white70)),
            subtitle: Text(p.timestamp.toIso8601String().substring(0, 10), style: const TextStyle(color: Colors.white24, fontSize: 11)),
            onTap: () { 
              Navigator.pop(context); 
              ref.read(mapProvider.notifier).animatedMoveTo(p.location, 14.0, this);
            },
          );
        },
      );
    },
  );
}
