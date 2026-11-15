#!/usr/bin/env bash
# Backup del database: copia consistente anche mentre il server scrive.
#   ./deploy/backup.sh [cartella]
#
# Va in cron (es. 03:15) sul server:
#   15 3 * * * /var/www/StreamHub_J.A.R.V.I.S./deploy/backup.sh /backup
set -euo pipefail

DEST="${1:-/backup}"
VOLUME="${STREAMHUB_VOLUME:-streamhub_jarvis_streamhub_data}"
DB="$VOLUME/_data/streamhub.db"
STAMP="$(date +%F)"

docker run --rm \
  -v "$VOLUME:/data:ro" \
  -v "$DEST:/backup" \
  alpine:3 sh -c "apk add --no-cache sqlite >/dev/null 2>&1; sqlite3 /data/streamhub.db \".backup '/backup/streamhub-$STAMP.db'\""

echo "backup: $DEST/streamhub-$STAMP.db"

# retention: 14 giorni
find "$DEST" -name 'streamhub-*.db' -mtime +14 -delete 2>/dev/null || true
