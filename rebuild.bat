@echo off
:: Update the local FAST (production) build after new code: stop the running server, apply new migrations,
:: rebuild (about 8 minutes), then start it again. Every page then opens instantly.
setlocal
cd /d "%~dp0"

echo =======================================================
echo     MR RENT A CAR - REBUILD (FAST mode)
echo =======================================================
echo.

docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker is not running. Start Docker Desktop and try again.
    pause
    exit /b 1
)

echo [1/4] Stopping the running server...
docker compose up -d >nul
docker compose restart dev >nul
echo.

echo [2/4] Updating packages and database...
docker compose exec -T -e CI=true dev pnpm install --frozen-lockfile
docker compose exec -T dev pnpm db:generate
docker compose exec -T dev pnpm db:migrate
echo.

echo [3/4] Building - about 8 minutes...
docker compose exec -T -e SKIP_TYPECHECK=1 -e NODE_OPTIONS=--max-old-space-size=3072 dev sh -c "cd apps/web && npx next build --no-lint"
if errorlevel 1 (
    echo.
    echo [ERROR] Build failed - see the messages above.
    pause
    exit /b 1
)
echo.

echo [4/4] Starting - the ERP opens in your browser when it is up...
start "" /min powershell -NoProfile -Command "for($i=0;$i -lt 300;$i++){try{Invoke-WebRequest http://localhost:3001/admin/login -UseBasicParsing -TimeoutSec 180 | Out-Null; break}catch{if($_.Exception.Response){break}; Start-Sleep 2}}; Start-Process http://localhost:3001/admin"
echo     ERP: http://localhost:3001/admin    Website: http://localhost:3001/
echo     Press Ctrl+C to stop the server.
echo.
docker compose exec dev sh -c "cd apps/web && npx next start -p 3001"
