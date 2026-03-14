import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:supercluster/supercluster.dart';
import 'package:latlong2/latlong.dart';
import '../models/event_item.dart';

class OptimizedMarkerPainter extends CustomPainter {
  final List<LayerElement<EventItem>> elements;
  final MapCamera camera;
  final Set<int> selectedIds;

  final Rect? selectionRect;

  OptimizedMarkerPainter({
    required this.elements,
    required this.camera,
    required this.selectedIds,
    this.selectionRect,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..isAntiAlias = true;

    for (final element in elements) {
      final pos = camera.getOffsetFromOrigin(LatLng(element.y, element.x));
      if (pos.dx < -60 || pos.dx > size.width + 60 || pos.dy < -60 || pos.dy > size.height + 60) continue;

      if (element is LayerCluster<EventItem>) {
        _drawEventMap2Cluster(canvas, pos, element, paint);
      } else if (element is LayerPoint<EventItem>) {
        _drawPremiumMarker(canvas, pos, element.originalPoint, paint);
      }
    }

    if (selectionRect != null) {
      paint.color = const Color(0xFF8B5E3C).withValues(alpha: 0.15); // Cookie Bronze
      canvas.drawRect(selectionRect!, paint);
      paint.color = const Color(0xFFD2B48C).withValues(alpha: 0.6); // Tan Glow
      paint.style = PaintingStyle.stroke;
      paint.strokeWidth = 1.5;
      canvas.drawRect(selectionRect!, paint);
      paint.style = PaintingStyle.fill;
    }
  }

  void _drawPremiumMarker(Canvas canvas, Offset pos, EventItem item, Paint paint) {
    final bool isSelected = selectedIds.contains(item.id);
    final Color markerColor = Color(int.parse(item.color.replaceFirst('#', '0xFF')));

    if (isSelected) {
      paint.color = markerColor.withValues(alpha: 0.4);
      canvas.drawCircle(pos, 24, paint);
    }

    // Outer Glow
    paint.color = markerColor.withValues(alpha: 0.2);
    canvas.drawCircle(pos, 14, paint);

    // Core
    paint.color = Colors.white;
    canvas.drawCircle(pos, 10, paint);
    paint.color = markerColor;
    canvas.drawCircle(pos, 7.5, paint);
  }

  void _drawEventMap2Cluster(Canvas canvas, Offset pos, LayerCluster<EventItem> cluster, Paint paint) {
    final count = cluster.childPointCount;
    // EventMap2 스타일 색상 매핑
    final Color clusterColor = count > 50 
        ? const Color(0xFF5D3E2A)  // Deep Cocoa
        : (count > 10 ? const Color(0xFF8B5E3C) : const Color(0xFFBC8F8F)); // Cookie Bronze / Rosy Brown
    
    final double side = 32.0 + (log(max(count, 1)) * 4.0);
    final RRect rect = RRect.fromRectAndRadius(
      Rect.fromCenter(center: pos, width: side, height: side),
      const Radius.circular(8),
    );

    // 1. Shadow / Glow
    paint.color = clusterColor.withValues(alpha: 0.3);
    canvas.drawRRect(rect.inflate(4), paint);

    // 2. Main Box
    paint.color = clusterColor.withValues(alpha: 0.9);
    canvas.drawRRect(rect, paint);

    // 3. Number
    final textPainter = TextPainter(
      text: TextSpan(
        text: count.toString(),
        style: TextStyle(
          color: Colors.white,
          fontSize: (side * 0.45).clamp(10, 16),
          fontWeight: FontWeight.w900,
        ),
      ),
      textDirection: TextDirection.ltr,
    );
    textPainter.layout();
    textPainter.paint(canvas, pos - Offset(textPainter.width / 2, textPainter.height / 2));
  }

  @override
  bool shouldRepaint(covariant OptimizedMarkerPainter oldDelegate) {
    return oldDelegate.elements != elements || 
           oldDelegate.selectedIds != selectedIds ||
           oldDelegate.camera != camera ||
           oldDelegate.selectionRect != selectionRect;
  }
}
