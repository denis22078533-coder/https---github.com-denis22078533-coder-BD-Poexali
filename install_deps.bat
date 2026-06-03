@echo off
cd /d "%~dp0doc-service"
call venv\Scripts\activate
echo Устанавливаем зависимости...
pip install fastapi uvicorn sqlalchemy python-jose[cryptography] passlib[bcrypt] python-multipart aiosqlite
echo.
echo Готово! Теперь запустите start_server.bat
pause