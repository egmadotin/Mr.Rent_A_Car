@echo off
:: Deploy the latest commits on GitHub to the server: logs in, pulls, rebuilds and restarts.
:: Push your changes to GitHub first (main branch). Uses your SSH key (no password prompt once the key is on the server).
setlocal
set SERVER=root@145.223.18.134
set APP_DIR=/opt/platform/client/mr-rent-a-car

echo Deploying Mr Rent A Car to %SERVER% ...
ssh -i "%USERPROFILE%.sshid_ed25519_personal" -o IdentitiesOnly=yes %SERVER% "cd %APP_DIR% && bash deploy/server-deploy.sh"
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo [ERROR] Deploy failed - see the messages above.
  pause
  exit /b 1
)
echo.
echo Done.
pause
