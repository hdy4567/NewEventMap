import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

class IoFile {
  final String path;
  IoFile(this.path);
  Future<void> writeAsString(String contents, {bool flush = false}) async {}
}

Future<String> getAppSupportPath() async => '';

ImageProvider getFileImage(String path) => NetworkImage(path);
VideoPlayerController? getFileVideoController(String path) => null;
