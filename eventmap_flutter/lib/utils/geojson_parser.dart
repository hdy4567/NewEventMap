import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter/foundation.dart';

Future<List<Polygon>> parseGeojson(String path, Color color) async {
  final jsonString = await rootBundle.loadString(path);
  return compute(_parseGeojsonIsolate, {'jsonString': jsonString, 'value': color.toARGB32()});
}

List<Polygon> _parseGeojsonIsolate(Map<String, dynamic> params) {
  final jsonString = params['jsonString'] as String;
  final colorValue = params['value'] as int;
  final color = Color(colorValue);
  
  final data = jsonDecode(jsonString);
  final List<Polygon> polygons = [];

  if (data['type'] == 'FeatureCollection' && data['features'] != null) {
    for (var feature in data['features']) {
      final geometry = feature['geometry'];
      final properties = feature['properties'] ?? {};
      if (geometry == null) continue;

      // Extract high-probability name properties
      final String? regionName = properties['NAME_1'] ?? 
                               properties['name'] ?? 
                               properties['name_ko'] ?? 
                               properties['nl_name_1'] ?? 
                               properties['ENG_NM'];

      if (geometry['type'] == 'Polygon') {
        final coords = geometry['coordinates'];
        for (var ring in coords) {
          polygons.add(_buildPolygon(ring, color, regionName));
        }
      } else if (geometry['type'] == 'MultiPolygon') {
        final coords = geometry['coordinates'];
        for (var multi in coords) {
          for (var ring in multi) {
            polygons.add(_buildPolygon(ring, color, regionName));
          }
        }
      }
    }
  }
  return polygons;
}

Polygon _buildPolygon(List ring, Color color, String? label) {
  final List<LatLng> points = [];
  for (var coord in ring) {
    if (coord is List && coord.length >= 2) {
      double lng = double.tryParse(coord[0].toString()) ?? 0.0;
      double lat = double.tryParse(coord[1].toString()) ?? 0.0;
      points.add(LatLng(lat, lng));
    }
  }
  return Polygon(
    points: points,
    color: color.withValues(alpha: 0.15),
    borderColor: color.withValues(alpha: 0.8),
    borderStrokeWidth: 1.5,
    label: label,
  );
}
