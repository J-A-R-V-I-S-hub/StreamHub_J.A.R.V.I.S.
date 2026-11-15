import 'package:flutter/material.dart';

import '../api/client.dart';

class AddSourceScreen extends StatefulWidget {
  const AddSourceScreen({super.key, required this.api, required this.line});
  final ApiClient api;
  final Line line;

  @override
  State<AddSourceScreen> createState() => _AddSourceScreenState();
}

class _AddSourceScreenState extends State<AddSourceScreen> {
  final _url = TextEditingController();
  final _user = TextEditingController();
  final _pass = TextEditingController();
  bool _busy = false;
  String? _message;
  bool _isError = false;

  @override
  void dispose() {
    _url.dispose();
    _user.dispose();
    _pass.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final url = _url.text.trim();
    if (url.isEmpty) {
      setState(() {
        _message = 'Incolla il link della playlist.';
        _isError = true;
      });
      return;
    }
    setState(() {
      _busy = true;
      _message = 'Aggiungo la sorgente…';
      _isError = false;
    });
    try {
      await widget.api.addSource(
        widget.line.id,
        url: url,
        username: _user.text.trim(),
        password: _pass.text,
      );
      final sources = await widget.api.sources(widget.line.id);
      if (sources.isEmpty) throw ApiException('sorgente non salvata');
      final last = sources.last;
      setState(() => _message = 'Sincronizzo il catalogo…');
      final result = await widget.api.syncSource(last['id'] as String);
      if (!mounted) return;
      setState(() {
        _message = 'Fatto: ${result['movies'] ?? 0} film, ${result['live'] ?? 0} canali.';
        _isError = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _message = e.message;
        _isError = true;
      });
    } catch (e) {
      setState(() {
        _message = '$e';
        _isError = true;
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Aggiungi sorgente · ${widget.line.name}')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Incolla qui il link della tua playlist',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          const Text(
            'Se il tuo fornitore ti ha dato anche utente e password, mettili qui sotto.',
            style: TextStyle(fontSize: 12, color: Color(0xFFC9A3A3)),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _url,
            keyboardType: TextInputType.url,
            decoration: const InputDecoration(labelText: 'Link della playlist'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _user,
            decoration: const InputDecoration(labelText: 'Utente (se serve)'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _pass,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Password (se serve)'),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _busy ? null : _save,
            child: _busy
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Aggiungi e sincronizza'),
          ),
          if (_message != null) ...[
            const SizedBox(height: 16),
            Text(
              _message!,
              style: TextStyle(color: _isError ? const Color(0xFFFF8A80) : const Color(0xFF9BD49B)),
            ),
          ],
        ],
      ),
    );
  }
}
