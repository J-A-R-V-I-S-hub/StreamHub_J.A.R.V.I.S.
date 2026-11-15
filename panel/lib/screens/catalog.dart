import 'package:flutter/material.dart';

import '../api/client.dart';

class CatalogScreen extends StatefulWidget {
  const CatalogScreen({super.key, required this.api, required this.line});
  final ApiClient api;
  final Line line;

  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  Catalog? _catalog;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final c = await widget.api.catalog(widget.line.id);
      setState(() => _catalog = c);
    } catch (e) {
      setState(() => _error = '$e');
    }
  }

  Widget _poster(CatalogItem item) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: item.poster.isEmpty
                ? const ColoredBox(
                    color: Color(0xFF2A1216),
                    child: Center(child: Icon(Icons.movie, color: Color(0xFF6B4B4B))),
                  )
                : Image.network(
                    item.poster,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stack) => const ColoredBox(
                      color: Color(0xFF2A1216),
                      child: Center(child: Icon(Icons.broken_image, color: Color(0xFF6B4B4B))),
                    ),
                    loadingBuilder: (_, child, progress) =>
                        progress == null ? child : const ColoredBox(color: Color(0xFF2A1216)),
                  ),
          ),
          Padding(
            padding: const EdgeInsets.all(8),
            child: Text(
              item.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = _catalog;
    return Scaffold(
      appBar: AppBar(
        title: Text('Catalogo · ${widget.line.name}'),
        actions: [IconButton(onPressed: _load, icon: const Icon(Icons.refresh))],
      ),
      body: _error != null
          ? Center(child: Text(_error!, style: const TextStyle(color: Color(0xFFFF8A80))))
          : c == null
              ? const Center(child: CircularProgressIndicator())
              : CustomScrollView(
                  slivers: [
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Text(
                          '${c.movies.length} film · ${c.live.length} canali · ${c.categories.length} categorie',
                          style: const TextStyle(color: Color(0xFFC9A3A3)),
                        ),
                      ),
                    ),
                    if (c.movies.isEmpty && c.live.isEmpty)
                      const SliverFillRemaining(
                        child: Center(
                          child: Padding(
                            padding: EdgeInsets.all(24),
                            child: Text(
                              'Catalogo vuoto.\nAggiungi una sorgente e premi sincronizza.',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: Color(0xFFC9A3A3)),
                            ),
                          ),
                        ),
                      )
                    else
                      SliverPadding(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        sliver: SliverGrid(
                          gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                            maxCrossAxisExtent: 140,
                            childAspectRatio: 0.62,
                            crossAxisSpacing: 8,
                            mainAxisSpacing: 8,
                          ),
                          delegate: SliverChildBuilderDelegate(
                            (_, i) => _poster(c.movies[i]),
                            childCount: c.movies.length,
                          ),
                        ),
                      ),
                  ],
                ),
    );
  }
}
