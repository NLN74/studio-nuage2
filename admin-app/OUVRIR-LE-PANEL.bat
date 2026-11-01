@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js doit etre installe sur cet ordinateur. Contactez la personne qui s'occupe du site.
 pause
 exit /b 1
)
start "Panel Nuage" http://127.0.0.1:4380/admin/
node server.mjs
pause
