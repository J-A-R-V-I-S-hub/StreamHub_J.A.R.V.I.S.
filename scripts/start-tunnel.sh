#!/usr/bin/env bash
#
# Apre un tunnel HTTPS pubblico verso il backend locale (Cloudflare Quick Tunnel).
# Nessun account e nessun costo: cloudflared assegna un URL *.trycloudflare.com
# con certificato TLS valido, utilizzabile direttamente da IBO Player Pro.
#
#   bash scripts/start-tunnel.sh [PORTA]
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${1:-8080}"
BIN="$ROOT/tools/cloudflared"

if [ ! -x "$BIN" ]; then
  echo "cloudflared non trovato in tools/. Installazione in corso..."
  mkdir -p "$ROOT/tools"
  ARCH="$(uname -m)"
  case "$ARCH" in
    arm64) TARBALL="cloudflared-darwin-arm64.tgz" ;;
    *)     TARBALL="cloudflared-darwin-amd64.tgz" ;;
  esac
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  curl -sSL -o "$TMP/cf.tgz" \
    "https://github.com/cloudflare/cloudflared/releases/latest/download/$TARBALL"
  tar xzf "$TMP/cf.tgz" -C "$TMP"
  mv "$TMP/cloudflared" "$BIN"
  chmod +x "$BIN"
  echo "cloudflared installato: $("$BIN" --version)"
fi

# 127.0.0.1 e non "localhost": su alcuni sistemi localhost risolve a [::1]
# (IPv6) e cloudflared non trova il server che ascolta solo su IPv4.
echo "Apertura tunnel verso http://127.0.0.1:$PORT ..."
echo "L'URL pubblico apparira' qui sotto (CTRL+C per chiuderlo)."
echo

exec "$BIN" tunnel --no-autoupdate --url "http://127.0.0.1:$PORT"
