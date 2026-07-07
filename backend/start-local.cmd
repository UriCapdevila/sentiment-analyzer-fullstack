@echo off
cd /d "%~dp0"
node server.js >> backend-dev.log 2>&1
