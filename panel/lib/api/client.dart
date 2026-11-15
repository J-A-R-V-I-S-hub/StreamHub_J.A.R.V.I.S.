import 'dart:convert';

import 'package:http/http.dart' as http;

class ApiException implements Exception {
  ApiException(this.message, {this.status});
  final String message;
  final int? status;
  @override
  String toString() => message;
}

class User {
  User(this.id, this.email, this.role, this.plan);
  final String id;
  final String email;
  final String role;
  final String plan;
  bool get isAdmin => role == 'admin';

  static User fromJson(Map<String, dynamic> j) => User(
        j['id'] as String,
        j['email'] as String,
        (j['role'] ?? 'user') as String,
        (j['plan'] ?? 'trial') as String,
      );
}

class Line {
  Line(this.id, this.name, this.status, this.username, this.expiresAt);
  final String id;
  final String name;
  final String status;
  final String username;
  final String? expiresAt;

  static Line fromJson(Map<String, dynamic> j) => Line(
        j['id'] as String,
        j['name'] as String,
        (j['status'] ?? 'active') as String,
        (j['xtream_username'] ?? '') as String,
        j['expires_at'] as String?,
      );
}

/// I 4 valori che si digitano sul telecomando.
class ConnectInfo {
  ConnectInfo(this.playlistName, this.playlistUrl, this.username, this.password);
  final String playlistName;
  final String playlistUrl;
  final String username;
  final String password;

  static ConnectInfo fromJson(Map<String, dynamic> j) => ConnectInfo(
        j['playlist_name'] as String,
        j['playlist_url'] as String,
        j['username'] as String,
        j['password'] as String,
      );
}

class CatalogItem {
  CatalogItem(this.name, this.poster, this.plot, this.year, this.rating, this.streamId);
  final String name;
  final String poster;
  final String plot;
  final int? year;
  final double? rating;
  final int streamId;

  static CatalogItem fromJson(Map<String, dynamic> j) => CatalogItem(
        (j['name'] ?? '') as String,
        (j['icon'] ?? '') as String,
        (j['plot'] ?? '') as String,
        j['year'] as int?,
        (j['rating'] as num?)?.toDouble(),
        (j['stream_id'] ?? 0) as int,
      );
}

class Catalog {
  Catalog(this.movies, this.live, this.categories);
  final List<CatalogItem> movies;
  final List<CatalogItem> live;
  final List<String> categories;
}

class ApiClient {
  ApiClient(this.baseUrl, {http.Client? httpClient})
      : _http = httpClient ?? http.Client();

  final String baseUrl;
  final http.Client _http;
  String? _token;

  String? get token => _token;

  Map<String, String> get _headers => {
        'content-type': 'application/json',
        if (_token != null) 'authorization': 'Bearer $_token',
      };

  Uri _uri(String path, [Map<String, String>? query]) =>
      Uri.parse('$baseUrl$path').replace(queryParameters: query);

  dynamic _decode(http.Response res) {
    final body = res.body.isEmpty ? null : jsonDecode(res.body);
    if (res.statusCode >= 400) {
      final msg = body is Map && body['message'] is String
          ? body['message'] as String
          : 'Errore ${res.statusCode}';
      throw ApiException(msg, status: res.statusCode);
    }
    return body;
  }

  Future<User> login(String email, String password) async {
    final res = await _http
        .post(_uri('/api/auth/login'),
            headers: _headers, body: jsonEncode({'email': email, 'password': password}))
        .timeout(const Duration(seconds: 15));
    final body = _decode(res) as Map<String, dynamic>;
    _token = body['token'] as String;
    return User.fromJson(body['user'] as Map<String, dynamic>);
  }

  Future<void> logout() async {
    try {
      await _http.post(_uri('/api/auth/logout'), headers: _headers).timeout(const Duration(seconds: 10));
    } catch (_) {}
    _token = null;
  }

  Future<List<Line>> lines() async {
    final res = await _http.get(_uri('/api/lines'), headers: _headers).timeout(const Duration(seconds: 15));
    final body = _decode(res) as Map<String, dynamic>;
    return (body['lines'] as List)
        .map((e) => Line.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Line> createLine(String name) async {
    final res = await _http
        .post(_uri('/api/lines'), headers: _headers, body: jsonEncode({'name': name}))
        .timeout(const Duration(seconds: 15));
    return Line.fromJson(_decode(res) as Map<String, dynamic>);
  }

  Future<void> deleteLine(String id) async {
    final res = await _http.delete(_uri('/api/lines/$id'), headers: _headers).timeout(const Duration(seconds: 15));
    if (res.statusCode >= 400 && res.statusCode != 404) _decode(res);
  }

  Future<ConnectInfo> connect(String lineId) async {
    final res = await _http
        .get(_uri('/api/lines/$lineId/connect'), headers: _headers)
        .timeout(const Duration(seconds: 15));
    return ConnectInfo.fromJson(_decode(res) as Map<String, dynamic>);
  }

  Future<Catalog> catalog(String lineId) async {
    final res = await _http
        .get(_uri('/api/lines/$lineId/catalog'), headers: _headers)
        .timeout(const Duration(seconds: 20));
    final body = _decode(res) as Map<String, dynamic>;
    return Catalog(
      (body['movies'] as List).map((e) => CatalogItem.fromJson(e as Map<String, dynamic>)).toList(),
      (body['live'] as List).map((e) => CatalogItem.fromJson(e as Map<String, dynamic>)).toList(),
      (body['categories'] as List).map((e) => (e as Map)['name'] as String).toList(),
    );
  }

  Future<void> addSource(String lineId, {required String url, String? username, String? password}) async {
    final res = await _http
        .post(_uri('/api/lines/$lineId/sources'),
            headers: _headers,
            body: jsonEncode({
              'type': 'm3u',
              'url': url,
              if (username != null && username.isNotEmpty) 'username': username,
              if (password != null && password.isNotEmpty) 'password': password,
            }))
        .timeout(const Duration(seconds: 20));
    _decode(res);
  }

  Future<Map<String, dynamic>> syncSource(String sourceId) async {
    final res = await _http
        .post(_uri('/api/sources/$sourceId/sync'), headers: _headers)
        .timeout(const Duration(minutes: 3));
    return _decode(res) as Map<String, dynamic>;
  }

  Future<List<Map<String, dynamic>>> sources(String lineId) async {
    final res = await _http
        .get(_uri('/api/lines/$lineId/sources'), headers: _headers)
        .timeout(const Duration(seconds: 15));
    final body = _decode(res) as Map<String, dynamic>;
    return (body['sources'] as List).cast<Map<String, dynamic>>();
  }
}
