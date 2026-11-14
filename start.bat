@echo off
rem Starts ENI Tutor at http://localhost:8000
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get it from https://nodejs.org and try again. & pause & exit /b 1)
if not exist .env echo Note: no .env file found. Copy .env.example to .env and add your API key, otherwise the chat will not work.
start "" http://localhost:8000
node server.mjs
pause
