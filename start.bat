@echo off
setlocal

echo =======================================================
echo     MR RENT A CAR - FULL SYSTEM STARTUP
echo     Starting: Frontend, Backend API, Database (Docker)
echo =======================================================
echo.

:: 1. Check if Docker is installed and running
echo [1/5] Checking Docker status...
docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Docker is not running or not found!
    echo Please make sure Docker Desktop is installed and running, then try again.
    echo.
    pause
    exit /b 1
)
echo [OK] Docker is running.
echo.

:: 2. Start PostgreSQL + the dev container. Restarting the dev container stops any server
::    still running in it (otherwise the new one fails with "port 3001 already in use").
echo [2/5] Starting Docker services (PostgreSQL db + Dev container)...
docker compose up -d
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Failed to start Docker services.
    pause
    exit /b 1
)
docker compose restart dev >nul
echo [OK] Containers started.
echo.

:: 3. Packages, Prisma client and migrations (quick when nothing changed)
echo [3/5] Installing packages and updating the database...
docker compose exec -T -e CI=true dev pnpm install --frozen-lockfile
docker compose exec -T dev pnpm db:generate
docker compose exec -T dev pnpm db:migrate
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Migration command returned an error. Retrying in 3 seconds...
    timeout /t 3 /nobreak >nul
    docker compose exec -T dev pnpm db:migrate
)
echo [OK] Database schema up to date.
echo.

:: 4. Choose the mode
echo [4/5] How do you want to run it?
echo     1 = FAST  - builds once (a few minutes), then every page opens instantly. Use this for testing.
echo     2 = DEV   - starts right away, code edits show live, but each page is slow the first time.
choice /c 12 /n /t 15 /d 1 /m "Press 1 or 2 (FAST in 15 seconds): "
set MODE=%ERRORLEVEL%
echo.

if "%MODE%"=="1" (
    echo Building the app - this takes a few minutes...
    docker compose exec -T dev sh -c "cd apps/web && npx next build --no-lint"
    if errorlevel 1 (
        echo.
        echo [ERROR] Build failed - see the messages above.
        pause
        exit /b 1
    )
)

:: 5. Open the ERP in the browser as soon as the server answers (runs in the background)
echo [5/5] The ERP opens in your browser as soon as the server is up...
start "" /min powershell -NoProfile -Command "for($i=0;$i -lt 300;$i++){try{Invoke-WebRequest http://localhost:3001/admin/login -UseBasicParsing -TimeoutSec 180 | Out-Null; break}catch{if($_.Exception.Response){break}; Start-Sleep 2}}; Start-Process http://localhost:3001/admin"
echo.

echo =======================================================
echo     System is ready!
echo     - ERP Staff Portal: http://localhost:3001/admin
echo     - Public Website:   http://localhost:3001/
echo     - PostgreSQL Port:  5442 (external) / 5432 (internal)
echo.
echo     Press Ctrl+C to stop the server.
echo =======================================================
echo.
if "%MODE%"=="1" (
    docker compose exec dev sh -c "cd apps/web && npx next start -p 3001"
) else (
    docker compose exec dev pnpm dev
)

echo.
echo Server stopped.
set /p STOP_DOCKER="Do you also want to stop the Docker containers? (y/N): "
if /i "%STOP_DOCKER%"=="y" (
    echo Stopping containers...
    docker compose down
    echo Containers stopped.
)
pause
