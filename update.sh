#!/usr/bin/env bash
# Mr Rent A Car - One-click pull & redeploy script
# Usage on server: ./update.sh OR /usr/local/bin/update-mr-rent-a-car
set -euo pipefail

APP_DIR="$(dirname "$(realpath "${BASH_SOURCE[0]}")")"
cd "$APP_DIR"

echo "=========================================================="
echo "  Mr Rent A Car - Updating Deployment & Database"
echo "=========================================================="

# Run server-deploy.sh to pull latest git commits, apply DB migrations, rebuild and restart
bash "$APP_DIR/deploy/server-deploy.sh"

echo "=========================================================="
echo "  Update and Deployment successfully completed!"
echo "  Live URL: $(grep '^PUBLIC_URL=' "$APP_DIR/.env.production" | cut -d= -f2)"
echo "=========================================================="
