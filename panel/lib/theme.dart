import 'package:flutter/material.dart';

const Color kJarvisGold = Color(0xFFF0B429);
const Color kJarvisBg = Color(0xFF140508);
const Color kJarvisCard = Color(0xFF1F0C10);

ThemeData jarvisTheme() {
  final scheme = ColorScheme.fromSeed(seedColor: kJarvisGold, brightness: Brightness.dark);
  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: scheme,
    scaffoldBackgroundColor: kJarvisBg,
    appBarTheme: const AppBarTheme(
      backgroundColor: kJarvisBg,
      foregroundColor: kJarvisGold,
      centerTitle: false,
    ),
    cardTheme: const CardThemeData(color: kJarvisCard),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xFF2A1216),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: kJarvisGold,
        foregroundColor: Colors.black,
        minimumSize: const Size.fromHeight(48),
      ),
    ),
  );
}
