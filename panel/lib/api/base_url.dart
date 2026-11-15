/// Indirizzo dell'API.
///
/// Web servito dal nostro nginx: stessa origine, nessun --dart-define.
/// App native (iOS/Android/desktop): l'origine non esiste, l'URL va compilato
/// dentro con `--dart-define=API_BASE_URL=https://...`.
const String kApiBaseUrl = String.fromEnvironment('API_BASE_URL');

String? resolveBaseUrl() {
  if (kApiBaseUrl.isNotEmpty) return kApiBaseUrl;
  final b = Uri.base;
  if (b.scheme == 'http' || b.scheme == 'https') return b.origin;
  return null;
}

const String kMissingBaseUrl =
    'Indirizzo API non configurato: ricompila con '
    '--dart-define=API_BASE_URL=https://tuo-dominio';
