import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

typedef IoFile = File;

Future<String> getAppSupportPath() async {
  final dir = await getApplicationSupportDirectory();
  return dir.path;
}

ImageProvider getFileImage(String path) => FileImage(File(path));
VideoPlayerController getFileVideoController(String path) => VideoPlayerController.file(File(path));
