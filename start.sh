#!/usr/bin/env bash
set -e

echo "======================================================="
echo "    MR RENT A CAR - FULL SYSTEM STARTUP"
echo "    Frontend, Backend API, Database (Docker)"
echo "======================================================="
echo ""

# 1. Check Docker
echo "[1/4] Checking Docker status..."
if ! docker info >/dev/null 2>&1; then
    echo "[ERROR] Docker is not running or not found!"
    echo "Please start Docker Desktop and run this script again."
    exit 1
fi
echo "[OK] Docker is running."
echo ""

# 2. Start containers
echo "[2/4] Starting Docker services..."
docker compose up -d
echo "[OK] Containers started."
echo ""

# 3. Migrate database
echo "[3/4] Ensuring database is ready and applying migrations..."
docker compose exec -T dev pnpm db:migrate
echo "[OK] Database schema up to date."
echo ""

# 4. Open browser if open/xdg-open exists
echo "[4/4] Opening ERP Admin..."
if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:3001/admin" >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then
    open "http://localhost:3001/admin" >/dev/null 2>&1 &
fi

echo ""
echo "======================================================="
echo "    System is ready!"
echo "    - ERP Staff Portal: http://localhost:3001/admin"
echo "    - Public Website:   http://localhost:3001/"
echo "    - PostgreSQL Port:  5442 (host) / 5432 (container)"
echo ""
echo "    Press Ctrl+C to stop the development server."
echo "======================================================="
echo ""

docker compose exec dev pnpm dev
