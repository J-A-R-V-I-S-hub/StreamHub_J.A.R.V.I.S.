import 'package:flutter/material.dart';

import 'api/base_url.dart';
import 'api/client.dart';
import 'screens/dashboard.dart';
import 'screens/login.dart';
import 'session.dart';
import 'theme.dart';

void main() => runApp(const JarvisApp());

class JarvisApp extends StatelessWidget {
  const JarvisApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'StreamHub J.A.R.V.I.S.',
      debugShowCheckedModeBanner: false,
      theme: jarvisTheme(),
      home: const RootScreen(),
    );
  }
}

class RootScreen extends StatefulWidget {
  const RootScreen({super.key});
  @override
  State<RootScreen> createState() => _RootScreenState();
}

class _RootScreenState extends State<RootScreen> {
  late final Session _session;
  String? _configError;

  @override
  void initState() {
    super.initState();
    final base = resolveBaseUrl();
    if (base == null) {
      _configError = kMissingBaseUrl;
      _session = Session(ApiClient('http://invalid'));
    } else {
      _session = Session(ApiClient(base));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_configError != null) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(_configError!, textAlign: TextAlign.center),
          ),
        ),
      );
    }
    if (!_session.isLoggedIn) {
      return LoginScreen(
        session: _session,
        onLoggedIn: (user) => setState(() => _session.user = user),
      );
    }
    return DashboardScreen(
      key: ValueKey(_session.user!.id),
      session: _session,
      onLogout: () async {
        await _session.api.logout();
        setState(() => _session.user = null);
      },
    );
  }
}
