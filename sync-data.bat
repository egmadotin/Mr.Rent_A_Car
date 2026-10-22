@echo off
:: Copy the local setup data to the live server: locations, rates, seasons, taxes, insurances, misc charges, templates,
:: user groups, users, vehicle types / makes / models and the vehicles -- WITHOUT customers, bookings, payments, test
:: vehicles (E-201, T-1xx, T-901) or test history (deploy/clean-export.sql).
:: The LIVE DATABASE IS REPLACED (it is backed up on the server first, in backups/).
:: Needs Docker running locally (start.bat) and your SSH key on the server. Deploy the latest code first (deploy.bat).
setlocal
set SERVER=root@145.223.18.134
set APP_DIR=/opt/platform/client/mr-rent-a-car
set KEY=%USERPROFILE%\.ssh\id_ed25519_personal

echo This REPLACES the live database with your local setup data (no customers or bookings).
choice /c YN /m "Continue"
if errorlevel 2 exit /b 0

echo [1/4] Making a clean copy of the local database...
docker compose exec -T db sh -c "dropdb -U postgres --if-exists mrac_export && createdb -U postgres mrac_export && pg_dump -U postgres -d mrac | psql -q -U postgres -d mrac_export" || goto :fail
docker compose cp deploy\clean-export.sql db:/tmp/clean-export.sql || goto :fail
docker compose exec -T db psql -q -v ON_ERROR_STOP=1 -U postgres -d mrac_export -f /tmp/clean-export.sql || goto :fail

echo [2/4] Writing the dump...
if not exist deploy\data mkdir deploy\data
docker compose exec -T db pg_dump -U postgres -d mrac_export -Fc -f /tmp/mrac-data.dump || goto :fail
docker compose cp db:/tmp/mrac-data.dump deploy\data\mrac-data.dump || goto :fail
docker compose exec -T db dropdb -U postgres mrac_export

echo [3/4] Uploading to the server...
ssh -i "%KEY%" -o IdentitiesOnly=yes %SERVER% "mkdir -p %APP_DIR%/deploy/data" || goto :fail
scp -i "%KEY%" -o IdentitiesOnly=yes deploy\data\mrac-data.dump %SERVER%:%APP_DIR%/deploy/data/mrac-data.dump || goto :fail

echo [4/4] Replacing the live database...
ssh -i "%KEY%" -o IdentitiesOnly=yes %SERVER% "cd %APP_DIR% && bash deploy/server-restore.sh deploy/data/mrac-data.dump" || goto :fail

echo.
echo Done.
pause
exit /b 0

:fail
echo.
echo [ERROR] Stopped - see the messages above. The live database is unchanged unless step 4 started.
pause
exit /b 1
