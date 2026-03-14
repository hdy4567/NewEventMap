import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../utils/sync_service.dart';

class PremiumTopPanel extends StatelessWidget {
  final Function(String) onSearch;
  final bool isAiActive;
  final Function(bool) onAiToggle;
  final String currentCountry;
  final Function(String) onCountrySelected;
  final String currentSubFilter;
  final Function(String) onSubFilterSelected;
  final List<String> dynamicTags;
  final VoidCallback onAddMemo;

  const PremiumTopPanel({
    super.key,
    required this.onSearch,
    required this.isAiActive,
    required this.onAiToggle,
    required this.currentCountry,
    required this.onCountrySelected,
    required this.currentSubFilter,
    required this.onSubFilterSelected,
    required this.onAddMemo,
    this.dynamicTags = const [],
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Tier 1: Search Bar
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: SearchBarOverlay(
            onSearch: onSearch,
            isAiActive: isAiActive,
            onAiToggle: onAiToggle,
          ),
        ),
        const SizedBox(height: 16),
        // Tier 2: Country / Domain Toggle
        CountrySelectorOverlay(
          currentCountry: currentCountry,
          onCountrySelected: onCountrySelected,
        ),
        const SizedBox(height: 14),
        // Tier 3: Sub-Categories / Regions
        SubTabsOverlay(
          currentCountry: currentCountry,
          currentSubFilter: currentSubFilter,
          onSubFilterSelected: onSubFilterSelected,
          dynamicTags: dynamicTags,
          onAddMemo: onAddMemo,
        ),
      ],
    );
  }
}

class SearchBarOverlay extends StatefulWidget {
  final Function(String) onSearch;
  final bool isAiActive;
  final Function(bool) onAiToggle;

  const SearchBarOverlay({
    super.key, 
    required this.onSearch,
    required this.isAiActive,
    required this.onAiToggle,
  });

  @override
  State<SearchBarOverlay> createState() => _SearchBarOverlayState();
}

class _SearchBarOverlayState extends State<SearchBarOverlay> {
  final TextEditingController _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      padding: const EdgeInsets.symmetric(horizontal: 16),
      height: 52,
      decoration: BoxDecoration(
        color: const Color(0xFF1A1714).withValues(alpha: 0.95), // Deep Cocoa
        borderRadius: BorderRadius.circular(26),
        border: Border.all(
          color: widget.isAiActive ? const Color(0xFFD2B48C).withValues(alpha: 0.6) : Colors.white.withValues(alpha: 0.1),
          width: 1.2,
        ),
        boxShadow: [
          if (widget.isAiActive)
            BoxShadow(color: const Color(0xFFD2B48C).withValues(alpha: 0.1), blurRadius: 15, spreadRadius: 2),
          BoxShadow(color: Colors.black.withValues(alpha: 0.4), blurRadius: 10, offset: const Offset(0, 4)),
        ],
      ),
      child: Row(
        children: [
          _buildLogo(),
          const SizedBox(width: 12),
          Expanded(child: _buildTextField()),
          if (_controller.text.isNotEmpty) _buildClearButton(),
          const VerticalDivider(width: 24, indent: 14, endIndent: 14, color: Colors.white12),
          _buildAiToggle(),
          const SizedBox(width: 12),
          const Icon(Icons.search, color: Color(0xFFD2B48C), size: 20),
        ],
      ),
    );
  }

  Widget _buildLogo() => Container(
    padding: const EdgeInsets.all(6),
    decoration: BoxDecoration(
      gradient: LinearGradient(
        colors: widget.isAiActive 
          ? [const Color(0xFFD2B48C), const Color(0xFF8B5E3C)] // Biscuit / Bronze
          : [const Color(0xFF8B5E3C), const Color(0xFF5D3E2A)], // Cookie Core
      ),
      borderRadius: BorderRadius.circular(8),
    ),
    child: Text(
      widget.isAiActive ? "AI" : "N", 
      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 13)
    ),
  );

  Widget _buildTextField() => TextField(
    controller: _controller,
    cursorColor: const Color(0xFFD2B48C),
    decoration: InputDecoration(
      hintText: widget.isAiActive ? "Master Brewer Assistant 활성화..." : "쿠즈모(Kuzmo)에 무엇을 기록할까요?",
      hintStyle: const TextStyle(color: Colors.white38, fontSize: 13, fontWeight: FontWeight.w400),
      border: InputBorder.none,
    ),
    style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500),
    onChanged: (val) { widget.onSearch(val); setState(() {}); },
  );

  Widget _buildClearButton() => GestureDetector(
    onTap: () { _controller.clear(); widget.onSearch(""); setState(() {}); },
    child: const Icon(Icons.cancel, color: Colors.white24, size: 18),
  );

  Widget _buildAiToggle() => InkWell(
    onTap: () => widget.onAiToggle(!widget.isAiActive),
    borderRadius: BorderRadius.circular(20),
    child: AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: widget.isAiActive ? Colors.amber.withValues(alpha: 0.2) : Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: widget.isAiActive ? Colors.amberAccent : Colors.white10),
      ),
      child: Icon(
        Icons.auto_awesome, 
        color: widget.isAiActive ? Colors.amberAccent : Colors.white24, 
        size: 16
      ),
    ),
  );
}

class CountrySelectorOverlay extends StatelessWidget {
  final String currentCountry;
  final Function(String) onCountrySelected;

  const CountrySelectorOverlay({
    super.key,
    required this.currentCountry,
    required this.onCountrySelected,
  });

  @override
  Widget build(BuildContext context) {
    final List<String> countries = ["Korea", "Japan", "Memo"];
    final double tabWidth = 90.0;
    final int activeIndex = countries.indexOf(currentCountry);

    return Container(
      height: 42,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(22),
      ),
      child: Stack(
        children: [
          // Sliding Indicator
          AnimatedPositioned(
            duration: const Duration(milliseconds: 300),
            curve: Curves.elasticOut,
            left: activeIndex * tabWidth,
            child: Container(
              width: tabWidth,
              height: 36,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [const Color(0xFF8B5E3C), const Color(0xFF5D3E2A)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(18),
                boxShadow: [
                  BoxShadow(color: const Color(0xFF8B5E3C).withValues(alpha: 0.3), blurRadius: 10, offset: const Offset(0, 4))
                ],
              ),
            ),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: countries.map((c) {
              final bool isActive = currentCountry == c;
              return GestureDetector(
                onTap: () => onCountrySelected(c),
                behavior: HitTestBehavior.opaque,
                child: Container(
                  width: tabWidth,
                  alignment: Alignment.center,
                  child: Text(
                    c == "Korea" ? "KR 🇰🇷" : (c == "Japan" ? "JP 🇯🇵" : "MEMO 📝"),
                    style: TextStyle(
                      color: isActive ? Colors.white : Colors.white60,
                      fontSize: 12,
                      letterSpacing: -0.2,
                      fontWeight: isActive ? FontWeight.w900 : FontWeight.w500,
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}


class SubTabsOverlay extends StatefulWidget {
  final String currentCountry;
  final String currentSubFilter;
  final Function(String) onSubFilterSelected;
  final List<String> dynamicTags;
  final VoidCallback onAddMemo;

  const SubTabsOverlay({
    super.key,
    required this.currentCountry,
    required this.currentSubFilter,
    required this.onSubFilterSelected,
    required this.onAddMemo,
    this.dynamicTags = const [],
  });

  @override
  State<SubTabsOverlay> createState() => _SubTabsOverlayState();
}

class _SubTabsOverlayState extends State<SubTabsOverlay> {
  final ScrollController _controller = ScrollController();
  final ValueNotifier<MouseCursor> _cursor = ValueNotifier(SystemMouseCursors.grab);
  double _startPos = 0;
  double _startOffset = 0;
  double _totalDelta = 0;
  double _velocity = 0;      // 💡 관성 계산용 속도
  DateTime? _lastMoveTime;    // 💡 시간차 계산용
  bool _isDragging = false;

  @override
  void dispose() {
    _controller.dispose();
    _cursor.dispose();
    super.dispose();
  }

  void _handlePointerDown(PointerDownEvent e) {
    _isDragging = true;
    _startPos = e.position.dx;
    
    if (_controller.hasClients) {
      // 💡 정지 로직: 이전의 Bounce-back 애니메이션이 돌고 있다면 즉시 멈춤 
      // 필드에 '착' 붙는 느낌을 주기 위함
      final current = _controller.offset;
      _controller.jumpTo(current);
      _startOffset = current;
    } else {
      _startOffset = 0;
    }
    
    _totalDelta = 0;
    _cursor.value = SystemMouseCursors.grabbing;
  }

  void _handlePointerMove(PointerMoveEvent e) {
    if (!_isDragging) return;
    
    final currentDist = _startPos - e.position.dx;
    
    // 💡 DISPLACEMENT MONITOR: 누적 변위가 아닌 절대 거리를 체크하여 트래킹 정확도 향상
    if (currentDist.abs() > _totalDelta) {
      _totalDelta = currentDist.abs();
    }

    if (_controller.hasClients) {
      final maxScroll = _controller.position.maxScrollExtent;
      double rawTarget = _startOffset + currentDist;
      
      double finalOffset;
      if (rawTarget < 0) {
        // 🚀 STEADY OVER-SCROLL (0.2x): 
        // math.pow의 비선형성 대신 선형 감쇄를 사용하여 '안 따라오는 느낌' 원천 차단
        finalOffset = rawTarget * 0.2; 
      } else if (rawTarget > maxScroll) {
        finalOffset = maxScroll + (rawTarget - maxScroll) * 0.2;
      } else {
        // 🚀 REAL-TIME MIRROR: 정상 범위에선 1:1 완벽 추적
        finalOffset = rawTarget;
      }

      // 💡 BOUNDARY PUSH: 최대 가용 범위를 -50~+50으로 제한하여 
      // 드래그 상태 이탈 방지 및 조작 밀도 최적화
      _controller.jumpTo(finalOffset.clamp(-55.0, maxScroll + 55.0));
    }
  }

  void _handlePointerCancel(PointerCancelEvent e) {
    _handlePointerUp(PointerUpEvent(
      pointer: e.pointer,
      kind: e.kind,
      device: e.device,
      position: e.position,
      buttons: e.buttons,
    ));
  }

  void _handlePointerUp(PointerUpEvent e) {
    _isDragging = false;
    _cursor.value = SystemMouseCursors.grab;
    _lastMoveTime = null;

    if (_controller.hasClients) {
      final current = _controller.offset;
      final maxScroll = _controller.position.maxScrollExtent;
      
      if (current < 0 || current > maxScroll) {
        // 🚀 FAST BOUNCE: 경계 밖이면 즉시 복귀 (Elastic 곡선으로 쫀득함 유지)
        _controller.animateTo(
          current < 0 ? 0 : maxScroll,
          duration: const Duration(milliseconds: 350),
          curve: Curves.easeOutCubic,
        );
      } else if (_velocity.abs() > 300) {
        // 🚀 SMOOTH FLING: 속도가 충분할 때만 자연스러운 감속 스크롤
        double flingDist = _velocity * 0.15;
        double target = (current + flingDist).clamp(0.0, maxScroll);
        _controller.animateTo(
          target,
          duration: const Duration(milliseconds: 600),
          curve: Curves.decelerate,
        );
      }
    }
    _velocity = 0;
  }

  @override
  Widget build(BuildContext context) {
    List<String> items = [];
    if (widget.currentCountry == "Korea") {
      items = ["전체", "서울", "경기도", "강원도", "충남", "충북", "제주도"];
    } else if (widget.currentCountry == "Japan") {
      items = ["전체", "도쿄", "오사카", "후쿠오카", "나고야", "니가타", "홋카이도", "오키나와"];
    } else {
      final Set<String> memoItems = {"전체", "@불꽃축제", "@전통축제", "@음식축제", "@기념축제"};
      memoItems.addAll(widget.dynamicTags.map((t) => "@$t"));
      items = memoItems.toList();
      if (!items.contains("+@태그명")) items.add("+@태그명");
    }

    return SizedBox(
      height: 40,
      child: RepaintBoundary(
        child: ValueListenableBuilder<MouseCursor>(
          valueListenable: _cursor,
          builder: (context, cursor, child) {
            return MouseRegion(
              cursor: cursor,
              child: child,
            );
          },
          child: Listener(
            onPointerDown: _handlePointerDown,
            onPointerMove: _handlePointerMove,
            onPointerUp: _handlePointerUp,
            onPointerCancel: _handlePointerCancel,
            behavior: HitTestBehavior.opaque,
            child: SingleChildScrollView(
              controller: _controller,
              scrollDirection: Axis.horizontal,
              physics: const NeverScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Row(
                children: items.map((item) {
                  final bool isActive = widget.currentSubFilter == item;
                  return Padding(
                    padding: const EdgeInsets.only(right: 12),
                    child: GestureDetector(
                      onTap: () {
                        // 💡 CLICK PROTECTION: Only select if this wasn't a drag/overscroll move
                        if (_totalDelta < 8.0) {
                          item == "+@태그명" ? widget.onAddMemo() : widget.onSubFilterSelected(item);
                        }
                      },
                      child: Container( // 🚀 Removed AnimatedContainer to eliminate ticker overhead
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        decoration: BoxDecoration(
                          color: isActive 
                              ? const Color(0xFFD2B48C).withValues(alpha: 0.15) 
                              : (item == "+@태그명" ? const Color(0xFFD2B48C).withValues(alpha: 0.05) : Colors.white.withValues(alpha: 0.05)),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isActive 
                              ? const Color(0xFFD2B48C) 
                              : (item == "+@태그명" ? const Color(0xFFD2B48C).withValues(alpha: 0.2) : Colors.white.withValues(alpha: 0.1)),
                            width: 1,
                          ),
                        ),
                        child: Center(
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (item == "+@태그명") const Icon(Icons.add_circle_outline, size: 14, color: Colors.amberAccent),
                              if (item == "+@태그명") const SizedBox(width: 6),
                              Text(
                                item,
                                style: TextStyle(
                                  color: isActive ? const Color(0xFFD2B48C) : (item == "+@태그명" ? const Color(0xFFD2B48C) : const Color(0xFFA8A096)),
                                  fontSize: 12,
                                  fontWeight: isActive || item == "+@태그명" ? FontWeight.w900 : FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class StorageOverlay extends StatelessWidget {
  final VoidCallback onTap;

  const StorageOverlay({super.key, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          height: 56,
          width: 56,
          decoration: BoxDecoration(
            color: const Color(0xFF2E2925).withValues(alpha: 0.9), // Warm Slate Surface
            shape: BoxShape.circle,
            border: Border.all(color: const Color(0xFF8B5E3C).withValues(alpha: 0.5), width: 2), // Cookie Bronze
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.5),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: const Icon(Icons.inventory_2_outlined, color: Color(0xFFD2B48C), size: 28), // Tan
        ),
      ),
    );
  }
}

class MacDockOverlay extends StatefulWidget {
  const MacDockOverlay({super.key});

  @override
  State<MacDockOverlay> createState() => _MacDockOverlayState();
}

class _MacDockOverlayState extends State<MacDockOverlay> {
  bool _isOpen = false;
  final List<Map<String, String>> _apps = [
    {'name': 'Chrome', 'icon': '🌐', 'url': 'https://google.com', 'type': 'link'},
    {'name': 'Calendar', 'icon': '🗓️', 'url': 'https://calendar.google.com', 'type': 'link'},
    {'name': 'App Launcher', 'icon': '🚀', 'url': 'open://local-app.exe', 'type': 'exe'},
    {'name': 'System', 'icon': '⚙️', 'url': '', 'type': 'system'},
  ];

  void _addNewApp(String name, String url) {
    setState(() {
      _apps.add({
        'name': name,
        'icon': '🔖', // Default bookmark icon
        'url': url,
        'type': 'link',
      });
    });
  }

  void _showAddDialog() {
    final nameController = TextEditingController();
    final urlController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1A1714),
        title: const Text("실시간 링크 추가", style: TextStyle(color: Colors.white)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(labelText: "이름", labelStyle: TextStyle(color: Colors.white60)),
            ),
            TextField(
              controller: urlController,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(labelText: "URL (http...)", labelStyle: TextStyle(color: Colors.white60)),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("취소")),
          ElevatedButton(
            onPressed: () {
              if (nameController.text.isNotEmpty && urlController.text.isNotEmpty) {
                _addNewApp(nameController.text, urlController.text);
                Navigator.pop(ctx);
              }
            },
            child: const Text("보관함에 추가"),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        if (_isOpen) _buildGrid(),
        const SizedBox(height: 12),
        _buildTrigger(),
      ],
    );
  }

  Widget _buildTrigger() => MouseRegion(
    cursor: SystemMouseCursors.click,
    onEnter: (_) => setState(() => _isOpen = true),
    child: GestureDetector(
      onTap: () => setState(() => _isOpen = !_isOpen),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        height: 56, width: 56,
        decoration: BoxDecoration(
          color: _isOpen ? const Color(0xFF8B5E3C) : const Color(0xFF2E2925).withValues(alpha: 0.95),
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white10, width: 2),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.5), blurRadius: 10, offset: const Offset(0, 4))],
        ),
        child: const Icon(Icons.apps, color: Colors.white, size: 28),
      ),
    ),
  );

  Widget _buildGrid() => MouseRegion(
    onExit: (_) => setState(() => _isOpen = false),
    child: Container(
      width: 320,
      constraints: const BoxConstraints(maxHeight: 400),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1714).withValues(alpha: 0.98),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.6), blurRadius: 20)],
      ),
      child: SingleChildScrollView(
        child: Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            ..._apps.map((app) => _DockItem(app: app)),
            _buildAddButton(),
          ],
        ),
      ),
    ),
  );

  Widget _buildAddButton() => InkWell(
    onTap: _showAddDialog,
    borderRadius: BorderRadius.circular(15),
    child: Container(
      height: 60, width: 60,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(15),
        border: Border.all(color: Colors.white10),
      ),
      child: const Icon(Icons.add_link_outlined, color: Colors.white54),
    ),
  );
}

class _DockItem extends StatefulWidget {
  final Map<String, String> app;
  const _DockItem({required this.app});

  @override
  State<_DockItem> createState() => _DockItemState();
}

class _DockItemState extends State<_DockItem> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onEnter: (e) => setState(() => _isHovered = true),
      onExit: (e) => setState(() => _isHovered = false),
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        onTap: () async {
          final urlStr = widget.app['url'];
          if (urlStr != null && urlStr.isNotEmpty) {
            final url = Uri.parse(urlStr);
            if (await canLaunchUrl(url)) await launchUrl(url);
          }
        },
        child: AnimatedScale(
          scale: _isHovered ? 1.15 : 1.0,
          duration: const Duration(milliseconds: 150),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            height: 64,
            width: 64,
            decoration: BoxDecoration(
              color: _isHovered ? const Color(0xFFD2B48C).withValues(alpha: 0.95) : Colors.white.withValues(alpha: 0.05), // Tan / Glass
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: _isHovered ? const Color(0xFF8B5E3C) : Colors.white10, // Bronze
                width: 2,
              ),
              boxShadow: _isHovered ? [
                BoxShadow(color: const Color(0xFFD2B48C).withValues(alpha: 0.4), blurRadius: 10)
              ] : [],
            ),
            child: Center(
              child: Text(
                widget.app['icon']!,
                style: const TextStyle(fontSize: 28),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// --- Supporting Widgets (AIChat, SyncIndicator) ---

class AIChatOverlay extends StatefulWidget {
  final Function(String) onQueryApply;
  const AIChatOverlay({super.key, required this.onQueryApply});

  @override
  State<AIChatOverlay> createState() => _AIChatOverlayState();
}

class _AIChatOverlayState extends State<AIChatOverlay> {
  bool _isOpen = false;
  final TextEditingController _controller = TextEditingController();
  final List<Map<String, String>> _messages = [
    {'role': 'ai', 'text': '안녕하세요! 어떤 여행 추억이나 장소를 찾아드릴까요?'}
  ];
  bool _isLoading = false;

  void _sendMessage() async {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    setState(() {
      _messages.add({'role': 'user', 'text': text});
      _controller.clear();
      _isLoading = true;
    });
    final response = await SyncService.instance.askAi(text);
    if (mounted) {
      setState(() {
        _messages.add({'role': 'ai', 'text': response});
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_isOpen) {
      return FloatingActionButton(
        onPressed: () => setState(() => _isOpen = true),
        backgroundColor: const Color(0xFF8B5E3C), // Cookie Bronze
        child: const Icon(Icons.psychology_outlined, color: Colors.white),
      );
    }
    return Container(
      width: 320, height: 450,
      decoration: BoxDecoration(
        color: const Color(0xFF1A1714).withValues(alpha: 0.98), // Deep Cocoa
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFF8B5E3C).withValues(alpha: 0.3)), // Cookie Bronze
        boxShadow: const [BoxShadow(color: Colors.black87, blurRadius: 25)],
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: const BoxDecoration(color: Color(0xFF8B5E3C), borderRadius: BorderRadius.vertical(top: Radius.circular(23))),
            child: Row(children: [
              const Icon(Icons.auto_awesome, color: Colors.white, size: 18),
              const SizedBox(width: 8),
              const Text("Cookie Assistant", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              const Spacer(),
              IconButton(icon: const Icon(Icons.close, color: Colors.white, size: 18), onPressed: () => setState(() => _isOpen = false)),
            ]),
          ),
          Expanded(child: _isLoading && _messages.last['role'] == 'user' 
            ? const Center(child: CircularProgressIndicator(color: Color(0xFFD2B48C))) // Tan
            : ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: _messages.length,
            itemBuilder: (ctx, i) {
              final m = _messages[i];
              final isAi = m['role'] == 'ai';
              final isQuery = isAi && (m['text']!.contains('@') || m['text']!.contains('#'));
              return Align(
                alignment: isAi ? Alignment.centerLeft : Alignment.centerRight,
                child: GestureDetector(
                  onTap: isQuery ? () => widget.onQueryApply(m['text']!) : null,
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isAi ? (isQuery ? const Color(0xFF8B5E3C).withValues(alpha: 0.2) : Colors.white10) : const Color(0xFF8B5E3C).withValues(alpha: 0.8),
                      borderRadius: BorderRadius.circular(16),
                      border: isQuery ? Border.all(color: const Color(0xFFD2B48C).withValues(alpha: 0.5)) : null,
                    ),
                    child: Text(m['text']!, style: const TextStyle(color: Colors.white, fontSize: 13)),
                  ),
                ),
              );
            },
          )),
          _buildInputArea(),
        ],
      ),
    );
  }

  Widget _buildInputArea() => Container(
    padding: const EdgeInsets.all(12),
    child: Row(children: [
      Expanded(child: TextField(controller: _controller, style: const TextStyle(color: Colors.white, fontSize: 13), decoration: const InputDecoration(hintText: "무엇을 도와드릴까요?", border: InputBorder.none, hintStyle: TextStyle(color: Colors.white24)))),
      IconButton(icon: const Icon(Icons.send, color: Color(0xFF8B5E3C)), onPressed: _sendMessage),
    ]),
  );
}

class SyncIndicator extends StatelessWidget {
  const SyncIndicator({super.key});
  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<bool>(
      valueListenable: SyncService.instance.isConnectedNotifier,
      builder: (context, isConnected, child) {
        return Icon(
          isConnected ? Icons.cloud_done : Icons.cloud_off, 
          color: isConnected ? const Color(0xFFD2B48C) : Colors.white24, // Tan for online
          size: 18
        );
      },
    );
  }
}
