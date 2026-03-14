import 'package:flutter/material.dart';
import 'package:chewie/chewie.dart';
import 'package:video_player/video_player.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:photo_view/photo_view.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';
import '../models/event_item.dart';
import '../utils/io_utils.dart';

class EventDetailSheet extends StatefulWidget {
  final EventItem item;
  final VoidCallback onClose;

  const EventDetailSheet({
    super.key,
    required this.item,
    required this.onClose,
  });

  @override
  State<EventDetailSheet> createState() => _EventDetailSheetState();
}

class _EventDetailSheetState extends State<EventDetailSheet> {
  final PageController _pageController = PageController();
  final AudioPlayer _audioPlayer = AudioPlayer();
  VideoPlayerController? _videoController;
  ChewieController? _chewieController;
  bool _isPlayingAudio = false;

  @override
  void initState() {
    super.initState();
    _initializeMedia();
  }

  void _initializeMedia() async {
    final videoContent = widget.item.contents.where((c) => c.type == 'video').firstOrNull;
    if (videoContent != null && videoContent.value != null) {
      final val = videoContent.value!;
      if (val.startsWith('http')) {
        _videoController = VideoPlayerController.networkUrl(Uri.parse(val));
      } else {
        _videoController = getFileVideoController(val);
      }

      if (_videoController != null) {
        await _videoController!.initialize();
        _chewieController = ChewieController(
          videoPlayerController: _videoController!,
          autoPlay: false,
          looping: false,
          aspectRatio: _videoController!.value.aspectRatio,
          materialProgressColors: ChewieProgressColors(
            playedColor: Colors.redAccent,
            handleColor: Colors.red,
            backgroundColor: Colors.white24,
            bufferedColor: Colors.white54,
          ),
        );
      }
      if (mounted) setState(() {});
    }
  }

  @override
  void dispose() {
    _pageController.dispose();
    _audioPlayer.dispose();
    _videoController?.dispose();
    _chewieController?.dispose();
    super.dispose();
  }

  Future<void> _toggleAudio(String path) async {
    if (_isPlayingAudio) {
      await _audioPlayer.pause();
    } else {
      Source source = path.startsWith('http') ? UrlSource(path) : DeviceFileSource(path);
      await _audioPlayer.play(source);
    }
    if (mounted) setState(() => _isPlayingAudio = !_isPlayingAudio);
  }

  @override
  Widget build(BuildContext context) {
    final visualContents = widget.item.contents.where((c) => c.type == 'image' || c.type == 'video').toList();
    final audioContents = widget.item.contents.where((c) => c.type == 'audio').toList();
    final textContents = widget.item.contents.where((c) => c.type == 'text').toList();

    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      decoration: BoxDecoration(
        color: const Color(0xFF1A1714).withValues(alpha: 0.98), // Deep Cocoa
        borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.5), blurRadius: 40, spreadRadius: 10)],
      ),
      child: Column(
        children: [
          // Drag Handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              width: 40, height: 4,
              decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2)),
            ),
          ),
          
          Expanded(
            child: CustomScrollView(
              physics: const BouncingScrollPhysics(),
              slivers: [
                // Media Gallery (Sliver)
                SliverToBoxAdapter(
                  child: SizedBox(
                    height: 300,
                    child: Stack(
                      children: [
                        PageView.builder(
                          controller: _pageController,
                          itemCount: visualContents.isNotEmpty ? visualContents.length : 1,
                          itemBuilder: (context, index) {
                            if (visualContents.isEmpty) return _buildCoverImage(widget.item.imageUrl);
                            
                            final content = visualContents[index];
                            if (content.type == 'video') {
                              return _chewieController != null 
                                ? Chewie(controller: _chewieController!)
                                : const Center(child: CircularProgressIndicator());
                            } else {
                              return _buildCoverImage(content.value ?? widget.item.imageUrl);
                            }
                          },
                        ),
                        if (visualContents.length > 1)
                          Positioned(
                            bottom: 16, left: 0, right: 0,
                            child: Center(
                              child: SmoothPageIndicator(
                                controller: _pageController,
                                count: visualContents.length,
                                effect: const ExpandingDotsEffect(
                                  dotHeight: 8, dotWidth: 8,
                                  activeDotColor: Color(0xFFD2B48C),
                                  dotColor: Colors.white24,
                                ),
                              ),
                            ),
                          ),
                        Positioned(
                          top: 16, right: 16,
                          child: CircleAvatar(
                            backgroundColor: Colors.black38,
                            child: IconButton(icon: const Icon(Icons.close, color: Colors.white), onPressed: widget.onClose),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // Content Details
                SliverPadding(
                  padding: const EdgeInsets.all(24),
                  sliver: SliverList(
                    delegate: SliverChildListDelegate([
                      // Header
                      Row(
                        children: [
                          _buildTypeChip(widget.item.theme, const Color(0xFF8B5E3C)), // Bronze
                          const SizedBox(width: 8),
                          _buildTypeChip(widget.item.region, Colors.white12),
                          const Spacer(),
                          Text(
                            widget.item.country,
                            style: GoogleFonts.inter(color: Colors.white38, fontSize: 12),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Text(
                        widget.item.title,
                        style: GoogleFonts.outfit(
                          fontSize: 28, fontWeight: FontWeight.bold, color: Colors.white
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        widget.item.summary,
                        style: GoogleFonts.inter(color: Colors.white70, fontSize: 14, height: 1.5),
                      ),
                      
                      const Divider(height: 48, color: Colors.white12),

                      // Audio Section
                      if (audioContents.isNotEmpty) ...[
                        Text("현장 녹음", style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
                        const SizedBox(height: 12),
                        ...audioContents.map((a) => _buildAudioTile(a.value ?? "")),
                        const SizedBox(height: 24),
                      ],

                      // Description Section
                      if (textContents.isNotEmpty) ...[
                        Text("기록", style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
                        const SizedBox(height: 12),
                        ...textContents.map((t) => Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.05), borderRadius: BorderRadius.circular(16)),
                          child: Text(
                            t.value ?? "",
                            style: GoogleFonts.inter(color: Colors.white.withValues(alpha: 0.8), fontSize: 14, height: 1.6),
                          ),
                        )),
                      ],

                      // Tags
                      const SizedBox(height: 32),
                      Wrap(
                        spacing: 8, runSpacing: 8,
                        children: widget.item.tags.map((tag) => Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            border: Border.all(color: Colors.white12),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text("#$tag", style: GoogleFonts.inter(color: Colors.white54, fontSize: 12)),
                        )).toList(),
                      ),
                      const SizedBox(height: 60), // Space for bottom
                    ]),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCoverImage(String path) {
    return PhotoView(
      imageProvider: path.startsWith('http') ? NetworkImage(path) : getFileImage(path),
      minScale: PhotoViewComputedScale.covered,
      maxScale: PhotoViewComputedScale.covered * 2,
    );
  }

  Widget _buildTypeChip(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(8)),
      child: Text(label, style: GoogleFonts.inter(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
    );
  }

  Widget _buildAudioTile(String path) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(color: Colors.white12, borderRadius: BorderRadius.circular(12)),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: const Color(0xFF8B5E3C),
            child: IconButton(
              icon: Icon(_isPlayingAudio ? Icons.pause : Icons.play_arrow, color: Colors.white),
              onPressed: () => _toggleAudio(path),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("Voice Memo", style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text(path.split('/').last, style: GoogleFonts.inter(color: Colors.white38, fontSize: 11), overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
