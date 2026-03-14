import 'package:flutter/material.dart';
import '../models/event_item.dart';

class MarkerItem extends StatelessWidget {
  final EventItem item;
  final bool isSelected;
  final VoidCallback onTap;

  const MarkerItem({
    super.key,
    required this.item,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    IconData? overlayIcon;
    bool hasVideo = item.contents.any((c) => c.type == 'video');
    bool hasAudio = item.contents.any((c) => c.type == 'audio');

    if (hasVideo) {
      overlayIcon = Icons.play_circle_fill;
    } else if (hasAudio) {
      overlayIcon = Icons.mic;
    }

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(
            color: isSelected ? Colors.yellow : Colors.white,
            width: 3,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.5),
              blurRadius: 10,
              offset: const Offset(0, 5),
            ),
          ],
          image: DecorationImage(
            image: NetworkImage(item.imageUrl),
            fit: BoxFit.cover,
            colorFilter: ColorFilter.mode(
              Colors.black.withValues(alpha: 0.2),
              BlendMode.darken,
            ),
          ),
        ),
        child: overlayIcon != null
            ? Center(
                child: Icon(
                  overlayIcon,
                  color: Colors.white,
                  size: 24,
                ),
              )
            : null,
      ),
    );
  }
}
