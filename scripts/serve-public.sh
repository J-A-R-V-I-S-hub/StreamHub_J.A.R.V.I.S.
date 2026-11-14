#!/usr/bin/env bash
#
# Espone il connettore su un URL HTTPS stabile, tramite Tailscale.
#
#   bash scripts/serve-public.sh            # rende il servizio pubblico (Funnel)
#   bash scripts/serve-public.sh serve      # solo nella tailnet (Serve)
#   bash scripts/serve-public.sh stop       # ferma
#   bash scripts/serve-public.sh status     # stato
#
# Perche': l'URL e' STABILE (non cambia a ogni riavvio, a differenza del
# tunnel "quick"), ha un certificato TLS valido e funziona da qualsiasi
# rete: la TV non deve piu' essere sulla stessa rete del computer.
#
# La prima volta va abilitato Funnel/Serve nella console Tailscale
# (il comando ti stampa il link esatto).

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-8080}"
MODE="${1:-funnel}"

TS=""
for candidate in \
  "/Applications/Tailscale.app/Contents/MacOS/Tailscale" \
  "$(command -v tailscale 2>/dev/null || true)"; do
  if [ -n "$candidate" ] && [ -x "$candidate" ]; then TS="$candidate"; break; fi
done

if [ -z "$TS" ]; then
  echo "  Tailscale non trovato: installalo da tailscale.com"
  exit 1
fi

# Il MagicDNS name del computer: e' l'URL che finisce sulla TV.
MAGIC_DNS=$(timeout 15 "$TS" status --json 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('Self', {}).get('DNSName', '').rstrip('.'))
except Exception:
    print('')
" 2>/dev/null)

case "$MODE" in
  stop)
    timeout 20 "$TS" serve --https=443 --bg off >/dev/null 2>&1
    timeout 20 "$TS" funnel --https=443 --bg off >/dev/null 2>&1
    echo "  Servizio pubblico chiuso."
    ;;

  status)
    timeout 20 "$TS" serve status 2>&1 | sed 's/^/  /'
    ;;

  serve)
    timeout 40 "$TS" serve --bg "$PORT" 2>&1 | sed 's/^/  /'
    ;;

  funnel)
    timeout 40 "$TS" funnel --bg --yes "$PORT" 2>&1 | sed 's/^/  /'
    ;;

  *)
    echo "  Uso: bash scripts/serve-public.sh [funnel|serve|stop|status]"
    exit 1
    ;;
esac

echo
if [ -n "$MAGIC_DNS" ]; then
  echo "  Nella playlist di IBO Player metti:"
  echo "    https://$MAGIC_DNS"
  echo
  echo "  E nel .env (stessa stringa):"
  echo "    SERVER_URL=https://$MAGIC_DNS"
  echo
fi

# Aggiorna il .env con lo stesso indirizzo, cosi' server e TV concordano.
if [ "$MODE" = "funnel" ] || [ "$MODE" = "serve" ]; then
  if [ -n "$MAGIC_DNS" ] && [ -f "$ROOT/.env" ]; then
    if python3 - "$ROOT/.env" "https://$MAGIC_DNS" <<'PY'
import re, sys
path, value = sys.argv[1], sys.argv[2]
s = open(path, encoding='utf-8').read()
if re.search(r'^SERVER_URL=', s, re.M):
    s = re.sub(r'^SERVER_URL=.*$', 'SERVER_URL=' + value, s, flags=re.M)
else:
    s = s.rstrip('\n') + '\nSERVER_URL=' + value + '\n'
open(path, 'w', encoding='utf-8').write(s)
PY
    then
      echo "  .env aggiornato: SERVER_URL=https://$MAGIC_DNS"
      echo "  Riavvia il server perche' lo legga."
    fi
  fi
fi
