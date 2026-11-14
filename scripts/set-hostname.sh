#!/usr/bin/env bash
#
# Rinomina l'host del Mac con un nome mDNS corto e stabile.
#
#   bash scripts/set-hostname.sh jarvis
#
# Dopo il riavvio (o subito, con `sudo dscacheutil -flushcache`) il Mac
# risponde a http://jarvis.local:<porta>, e l'indirizzo segue l'IP anche
# quando l'hotspot lo riassegna.
#
# Il nome mDNS (.local) e' l'unico indirizzo che non cambia: l'IP del Mac
# sull'hotspot puo' cambiare, il nome no.

set -euo pipefail

NAME="${1:-jarvis}"

case "$NAME" in
  *[!a-z0-9-]*|'') echo "  Il nome puo' contenere solo lettere minuscole, cifre e trattini."; exit 1 ;;
esac

echo "  Rinomina l'host in '$NAME.local' (chiede la password di amministratore)..."

# Serve un terminale per leggere la password: se non c'e', si avvisa.
if [ ! -t 0 ]; then
  echo
  echo "  Questo comando va lanciato da un terminale (serve la password)."
  echo "  In alternativa esegui a mano:"
  echo
  echo "    sudo scutil --set HostName $NAME"
  echo "    sudo scutil --set LocalHostName $NAME"
  echo "    sudo scutil --set ComputerName $NAME"
  echo "    sudo dscacheutil -flushcache"
  echo
  exit 1
fi

sudo scutil --set HostName "$NAME"
sudo scutil --set LocalHostName "$NAME"
sudo scutil --set ComputerName "$NAME"

sudo dscacheutil -flushcache 2>/dev/null || true
sudo killall -HUP mDNSResponder 2>/dev/null || true

echo
echo "  Fatto. Verifica con:"
echo "    ping -c1 $NAME.local"
echo
echo "  Poi nella playlist di IBO Player usa:"
echo "    http://$NAME.local:8080"
