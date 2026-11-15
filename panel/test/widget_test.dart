import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jarvis_panel/theme.dart';

/// Test di base: il tema si costruisce e l'app monta.
/// Le schermate vere parlano con l'API, quindi non si testano qui:
/// la copertura del backend sta in server/test.
void main() {
  testWidgets('il tema si costruisce', (tester) async {
    final theme = jarvisTheme();
    expect(theme.useMaterial3, isTrue);
    expect(theme.brightness, Brightness.dark);
  });

  testWidgets('una schermata minima monta con il tema', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: jarvisTheme(),
        home: const Scaffold(body: Center(child: Text('StreamHub'))),
      ),
    );
    expect(find.text('StreamHub'), findsOneWidget);
  });
}
