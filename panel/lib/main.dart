import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

/// Indirizzo dell'API, passato in fase di build:
///
///   flutter build web --dart-define=API_URL=https://api.esempio.it
///
/// Se non e' impostato, il pannello prova sul dominio da cui e' servito.
const String _apiUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: '',
);

/// Pagina di prova: verifica che il pannello (Flutter -> nginx -> dominio)
/// e l'API Xtream si parlino davvero.
class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _auth;
  List<dynamic>? _categories;

  String get _base {
    if (_apiUrl.isNotEmpty) return _apiUrl;
    return Uri.base.origin;
  }

  @override
  void initState() {
    super.initState();
    _check();
  }

  Future<void> _check() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final auth = await http
          .get(Uri.parse('$_base/player_api.php?username=prova&password=prova'))
          .timeout(const Duration(seconds: 10));
      final cats = await http
          .get(Uri.parse('$_base/player_api.php?action=get_vod_categories'))
          .timeout(const Duration(seconds: 10));

      _auth = jsonDecode(auth.body) as Map<String, dynamic>;
      _categories = jsonDecode(cats.body) as List<dynamic>;
      setState(() {});
    } catch (e) {
      _error = e.toString();
      setState(() {});
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      backgroundColor: const Color(0xFF140508),
      appBar: AppBar(
        title: const Text('J.A.R.V.I.S. — pannello'),
        backgroundColor: Colors.transparent,
        foregroundColor: const Color(0xFFF0B429),
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 640),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.hub, size: 72, color: Color(0xFFF0B429)),
                const SizedBox(height: 16),
                Text(
                  'StreamHub J.A.R.V.I.S.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Color(0xFFF0B429),
                    fontSize: 26,
                    letterSpacing: 3,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'API: $_base',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Color(0xFFC9A3A3), fontSize: 13),
                ),
                const SizedBox(height: 28),
                if (_loading)
                  const Center(
                    child: CircularProgressIndicator(color: Color(0xFFF0B429)),
                  )
                else if (_error != null)
                  Card(
                    color: const Color(0xFF2A0B0F),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(
                        'Errore: $_error',
                        style: const TextStyle(color: Color(0xFFFF8A80)),
                      ),
                    ),
                  )
                else
                  Card(
                    color: const Color(0xFF1A0A0C),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'API raggiunta',
                            style: TextStyle(
                              color: scheme.primary,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'auth = ${_auth?['user_info']?['auth']}',
                            style: const TextStyle(color: Color(0xFFE9E6E2)),
                          ),
                          Text(
                            'categorie VOD = ${_categories?.length ?? 0}',
                            style: const TextStyle(color: Color(0xFFE9E6E2)),
                          ),
                        ],
                      ),
                    ),
                  ),
                const SizedBox(height: 20),
                OutlinedButton.icon(
                  onPressed: _check,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Riprova'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFFF0B429),
                    side: const BorderSide(color: Color(0x66F0B429)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

void main() {
  runApp(
    MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'J.A.R.V.I.S.',
      theme: ThemeData(
        brightness: Brightness.dark,
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFFF0B429),
          brightness: Brightness.dark,
        ),
      ),
      home: const HomePage(),
    ),
  );
}
