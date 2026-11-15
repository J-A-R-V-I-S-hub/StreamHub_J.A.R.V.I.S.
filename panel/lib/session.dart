import 'api/client.dart';

/// Stato condiviso minimo: il client HTTP e l'utente collegato.
class Session {
  Session(this.api);
  final ApiClient api;
  User? user;
  bool get isLoggedIn => user != null;
}
