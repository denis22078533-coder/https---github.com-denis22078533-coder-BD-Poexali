@echo off
cd /d "%~dp0doc-service"
call venv\Scripts\activate
uvicorn app.main:app --reload
pause