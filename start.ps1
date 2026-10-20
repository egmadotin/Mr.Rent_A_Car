# Mr Rent A Car - Full Stack Launcher (PowerShell)
# Usage: .\start.ps1

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "    MR RENT A CAR - FULL SYSTEM STARTUP" -ForegroundColor Yellow
Write-Host "    Frontend (Next.js), Backend API, Database (PostgreSQL)" -ForegroundColor White
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check if Docker is running
Write-Host "[1/4] Checking Docker status..." -ForegroundColor Cyan
try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker not running"
    }
    Write-Host "[OK] Docker is running." -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Docker is not running or not found!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# 2. Start Docker containers
Write-Host "[2/4] Starting Docker services (PostgreSQL db + Dev container)..." -ForegroundColor Cyan
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to start Docker services." -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Containers started." -ForegroundColor Green
Write-Host ""

# 3. Ensure database is ready and run migrations
Write-Host "[3/4] Ensuring database is ready and applying migrations..." -ForegroundColor Cyan
docker compose exec -T dev pnpm db:migrate
if ($LASTEXITCODE -ne 0) {
    Write-Host "[WAIT] Database starting up, retrying in 3 seconds..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
    docker compose exec -T dev pnpm db:migrate
}
Write-Host "[OK] Database schema up to date." -ForegroundColor Green
Write-Host ""

# 4. Open browser
Write-Host "[4/4] Opening ERP Admin in your browser..." -ForegroundColor Cyan
Start-Process "http://localhost:3001/admin"

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "    System is ready!" -ForegroundColor Green
Write-Host "    - ERP Staff Portal: http://localhost:3001/admin" -ForegroundColor White
Write-Host "    - Public Website:   http://localhost:3001/" -ForegroundColor White
Write-Host "    - PostgreSQL Port:  5442 (host) / 5432 (container)" -ForegroundColor White
Write-Host ""
Write-Host "    Press Ctrl+C to stop the development server." -ForegroundColor Yellow
Write-Host "=======================================================" -ForegroundColor Green
Write-Host ""

# 5. Run dev server
docker compose exec dev pnpm dev
