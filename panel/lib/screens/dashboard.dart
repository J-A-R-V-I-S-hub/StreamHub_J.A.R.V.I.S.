import 'package:flutter/material.dart';

import '../api/client.dart';
import '../session.dart';
import 'add_source.dart';
import 'catalog.dart';
import 'connect.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, required this.session, required this.onLogout});
  final Session session;
  final VoidCallback onLogout;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  List<Line> _lines = [];
  bool _busy = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final lines = await widget.session.api.lines();
      setState(() => _lines = lines);
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _createLine() async {
    final name = await showDialog<String>(
      context: context,
      builder: (_) => const _NameDialog(),
    );
    if (name == null || name.trim().isEmpty) return;
    try {
      await widget.session.api.createLine(name.trim());
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  Widget _lineCard(Line line) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(line.name,
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                ),
                Chip(
                  label: Text(line.status),
                  backgroundColor: line.status == 'active'
                      ? const Color(0xFF1B3A1B)
                      : const Color(0xFF3A1B1B),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text('utente: ${line.username}',
                style: const TextStyle(fontSize: 12, color: Color(0xFFC9A3A3))),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilledButton.icon(
                  icon: const Icon(Icons.tv, size: 18),
                  label: const Text('Collega la TV'),
                  onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => ConnectScreen(api: widget.session.api, line: line),
                  )),
                ),
                OutlinedButton.icon(
                  icon: const Icon(Icons.grid_view, size: 18),
                  label: const Text('Catalogo'),
                  onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => CatalogScreen(api: widget.session.api, line: line),
                  )).then((_) => _load()),
                ),
                OutlinedButton.icon(
                  icon: const Icon(Icons.add_link, size: 18),
                  label: const Text('Sorgente'),
                  onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => AddSourceScreen(api: widget.session.api, line: line),
                  )).then((_) => _load()),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Le tue linee'),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh), tooltip: 'Aggiorna'),
          IconButton(onPressed: widget.onLogout, icon: const Icon(Icons.logout), tooltip: 'Esci'),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _createLine,
        icon: const Icon(Icons.add),
        label: const Text('Nuova linea'),
      ),
      body: _busy
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(_error!, textAlign: TextAlign.center,
                            style: const TextStyle(color: Color(0xFFFF8A80))),
                        const SizedBox(height: 12),
                        OutlinedButton(onPressed: _load, child: const Text('Riprova')),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                    children: [
                      if (_lines.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 48),
                          child: Text(
                            'Nessuna linea. Creane una con il pulsante in basso:\n'
                            'poi aggiungi la tua sorgente e collega la TV.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Color(0xFFC9A3A3)),
                          ),
                        ),
                      ..._lines.map(_lineCard),
                    ],
                  ),
                ),
    );
  }
}

class _NameDialog extends StatefulWidget {
  const _NameDialog();
  @override
  State<_NameDialog> createState() => _NameDialogState();
}

class _NameDialogState extends State<_NameDialog> {
  final _controller = TextEditingController(text: 'La mia TV');
  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Nome della linea'),
      content: TextField(
        controller: _controller,
        autofocus: true,
        decoration: const InputDecoration(labelText: 'Es. TV del salotto'),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Annulla')),
        FilledButton(
          onPressed: () => Navigator.pop(context, _controller.text),
          child: const Text('Crea'),
        ),
      ],
    );
  }
}
