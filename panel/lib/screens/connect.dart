import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api/client.dart';

/// La schermata che conta: i 4 campi da digitare in IBO Player.
class ConnectScreen extends StatefulWidget {
  const ConnectScreen({super.key, required this.api, required this.line});
  final ApiClient api;
  final Line line;

  @override
  State<ConnectScreen> createState() => _ConnectScreenState();
}

class _ConnectScreenState extends State<ConnectScreen> {
  ConnectInfo? _info;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final info = await widget.api.connect(widget.line.id);
      setState(() => _info = info);
    } catch (e) {
      setState(() => _error = '$e');
    }
  }

  Future<void> _copy(String label, String value) async {
    await Clipboard.setData(ClipboardData(text: value));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$label copiato')));
  }

  Widget _field(String label, String value, {bool secret = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 12, color: Color(0xFFC9A3A3))),
                const SizedBox(height: 2),
                SelectableText(
                  value,
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Copia $label',
            icon: const Icon(Icons.copy, size: 20),
            onPressed: () => _copy(label, value),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Collega la TV')),
      body: _error != null
          ? Center(child: Text(_error!, style: const TextStyle(color: Color(0xFFFF8A80))))
          : _info == null
              ? const Center(child: CircularProgressIndicator())
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    const Text(
                      'In IBO Player scegli «Add a new playlist» e copia questi 4 valori:',
                      style: TextStyle(color: Color(0xFFC9A3A3)),
                    ),
                    const SizedBox(height: 20),
                    _field('Playlist Name', _info!.playlistName),
                    _field('Playlist URL', _info!.playlistUrl),
                    _field('Username', _info!.username),
                    _field('Password', _info!.password, secret: true),
                    const SizedBox(height: 8),
                    const Text(
                      'Il nome della playlist è un campo a sé: non dimenticarlo, '
                      'è quello che vedrai sul telecomando.',
                      style: TextStyle(fontSize: 12, color: Color(0xFFC9A3A3)),
                    ),
                  ],
                ),
    );
  }
}
