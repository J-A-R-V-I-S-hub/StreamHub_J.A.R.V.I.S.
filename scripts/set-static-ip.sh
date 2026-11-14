#!/usr/bin/env bash
#
# Blocca l'indirizzo IP del computer sulla rete hotspot.
#
#   bash scripts/set-static-ip.sh              # usa IP/mask/router attuali
#   bash scripts/set-static-ip.sh 172.20.10.5 255.255.255.240 172.20.10.1
#
# Perche': sull'hotspot del telefono l'indirizzo e' in lease DHCP (1 ora) e
# puo' cambiare. Se cambia, la playlist della TV punta a un indirizzo morto.
# Qui lo si fissa, cosi' la TV non va piu' toccata.
#
# Nota: alcune Smart TV non risolvono i nomi .local (mDNS), quindi l'unico
# indirizzo affidabile e' l'IP.

set -euo pipefail

SERVICE="Wi-Fi"

if [ ! -t 0 ]; then
  echo
  echo "  Questo comando va lanciato da un terminale (serve la password)."
  echo "  In alternativa esegui a mano:"
  echo
  echo "    sudo networksetup -setmanual \"$SERVICE\" <IP> <mask> <router>"
  echo
  exit 1
fi

CURRENT_IP=$(ipconfig getifaddr en0 2>/dev/null || echo "")
CURRENT_MASK=$(networksetup -getinfo "$SERVICE" 2>/dev/null | awk '/Subnet mask/{print $3}')
CURRENT_ROUTER=$(networksetup -getinfo "$SERVICE" 2>/dev/null | awk '/^Router:/{print $2}')

IP="${1:-$CURRENT_IP}"
MASK="${2:-$CURRENT_MASK}"
ROUTER="${3:-$CURRENT_ROUTER}"

if [ -z "$IP" ] || [ -z "$MASK" ] || [ -z "$ROUTER" ]; then
  echo "  Non riesco a leggere la configurazione attuale. Passa i valori a mano:"
  echo "    bash scripts/set-static-ip.sh <IP> <mask> <router>"
  exit 1
fi

echo "  Configurazione attuale:"
echo "    IP     : $CURRENT_IP"
echo "    mask   : $CURRENT_MASK"
echo "    router : $CURRENT_ROUTER"
echo
echo "  La imposto su: $IP / $MASK / $ROUTER"
echo

sudo networksetup -setmanual "$SERVICE" "$IP" "$MASK" "$ROUTER"

echo "  Fatto. Verifica con:"
echo "    ifconfig en0 | grep 'inet '"
echo
echo "  Nella playlist di IBO Player metti:"
echo "    http://$IP:8080"
echo
echo "  Per tornare al DHCP:"
echo "    sudo networksetup -setdhcp \"$SERVICE\""
echo
