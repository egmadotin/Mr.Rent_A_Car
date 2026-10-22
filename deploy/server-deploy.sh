#!/usr/bin/env bash
# Runs ON THE SERVER: pull the latest commits from GitHub, rebuild and restart Mr Rent A Car.
#   bash deploy/server-deploy.sh            (normally started by deploy.bat / deploy.sh from your computer)
# First run creates .env.production with new secrets; pass APP_PORT=<port> the first time to choose the port.
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=.env.production
if [ ! -f "$ENV_FILE" ]; then
  PORT="${APP_PORT:-3100}"
  IP="$(hostname -I | awk '{print $1}')"
  echo "Creating $ENV_FILE (port $PORT)…"
  umask 077
  cat > "$ENV_FILE" <<EOF
# Mr Rent A Car production settings (server only — never commit)
APP_PORT=$PORT
PUBLIC_URL=http://$IP:$PORT
POSTGRES_PASSWORD=$(openssl rand -hex 24)
BETTER_AUTH_SECRET=$(openssl rand -hex 32)
PAYMENT_SECRETS_KEY=$(openssl rand -hex 32)
EOF
fi

echo "== Pulling latest commits"
git fetch --quiet origin
git reset --hard --quiet origin/main
git log --oneline -1

echo "== Building and restarting"
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" up -d --build --remove-orphans

echo "== Waiting for the app"
PORT="$(grep '^APP_PORT=' "$ENV_FILE" | cut -d= -f2)"
for i in $(seq 1 60); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/admin/login"; then
    echo "Up: $(grep '^PUBLIC_URL=' "$ENV_FILE" | cut -d= -f2)"
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 5
done
echo "The app didn't answer after 5 minutes. Recent logs:"
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" logs --tail 60 web
exit 1
