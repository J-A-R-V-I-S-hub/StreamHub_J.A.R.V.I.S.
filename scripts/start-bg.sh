#!/usr/bin/env bash
#
# Avvia il connettore in background, con un file di PID.
#
#   bash scripts/start-bg.sh          # avvia
#   bash scripts/start-bg.sh stop     # ferma
#   bash scripts/start-bg.sh status   # stato
#
# Serve per non tenere il terminale occupato: il server resta attivo
# anche chiudendo la finestra.
#
# Il log delle richieste finisce in /tmp/jarvis.log (e' anche quello che
# `npm run logs` mostra).

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="/tmp/jarvis.pid"
LOG_FILE="/tmp/jarvis.log"
TARGET="$ROOT/simple/server.js"

running() {
  [ -f "$PID_FILE" ] || return 1
  kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

case "${1:-start}" in
  stop)
    if running; then
      kill "$(cat "$PID_FILE")" 2>/dev/null
      rm -f "$PID_FILE"
      echo "  Fermato."
    else
      echo "  Non era in esecuzione."
    fi
    ;;

  status)
    if running; then
      echo "  In esecuzione (pid $(cat "$PID_FILE")) su http://localhost:8080"
      echo "  Log: $LOG_FILE"
    else
      echo "  Non in esecuzione."
    fi
    ;;

  start)
    if running; then
      echo "  Gia' in esecuzione (pid $(cat "$PID_FILE"))."
      exit 0
    fi
    cd "$ROOT"
    nohup node "$TARGET" > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    sleep 1
    if running; then
      echo "  Avviato (pid $(cat "$PID_FILE"))"
      echo "  URL locale : http://localhost:8080"
      echo "  URL di rete : http://$(hostname -s).local:8080"
      echo "  Log         : $LOG_FILE   (npm run logs)"
    else
      echo "  Avvio fallito, guarda il log:"
      tail -5 "$LOG_FILE"
      rm -f "$PID_FILE"
      exit 1
    fi
    ;;

  *)
    echo "  Uso: bash scripts/start-bg.sh [start|stop|status]"
    exit 1
    ;;
esac
