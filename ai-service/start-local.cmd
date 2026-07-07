@echo off
cd /d "%~dp0"
set "NLTK_DATA=%CD%\.venv\nltk_data;%APPDATA%\nltk_data"
.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 >> fastapi-dev.log 2>&1
