#!/usr/bin/env bash
# Runs ON THE SERVER: replace the live database with a dump made by sync-data.bat on your computer.
#   bash deploy/server-restore.sh deploy/data/mrac-data.dump
# The live database is backed up first to backups/live-<date>.dump (restore it the same way to undo).
set -euo pipefail
cd "$(dirname "$0")/.."

DUMP="${1:?usage: server-restore.sh <dump file>}"
[ -f "$DUMP" ] || { echo "No such file: $DUMP"; exit 1; }
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

mkdir -p backups
BACKUP="backups/live-$(date +%Y%m%d-%H%M%S).dump"
echo "== Backing up the live database to $BACKUP"
$COMPOSE exec -T db pg_dump -U mrac -d mrac -Fc > "$BACKUP"
ls -lh "$BACKUP"

echo "== Stopping the app"
$COMPOSE stop web

echo "== Replacing the database"
$COMPOSE exec -T db psql -v ON_ERROR_STOP=1 -U mrac -d mrac -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
$COMPOSE exec -T db pg_restore -U mrac -d mrac --no-owner --no-privileges --exit-on-error < "$DUMP"

echo "== Starting the app (applies any newer migrations)"
$COMPOSE up -d web
$COMPOSE exec -T db psql -U mrac -d mrac -tAc "select 'vehicles', count(*) from \"Vehicle\" union all select 'locations', count(*) from \"Location\" union all select 'user groups', count(*) from \"UserGroup\" union all select 'rates', count(*) from \"Rate\""
echo "Done. Backup kept at $BACKUP"
