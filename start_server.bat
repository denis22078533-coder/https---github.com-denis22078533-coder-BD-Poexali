@echo off
chcp 65001 >nul
cd /d "%~dp0doc-service"

if not exist "venv" (
    echo Виртуальное окружение не найдено!
    echo Запустите install_backend.bat сначала
    pause
    exit /b 1
)

call venv\Scripts\activate.bat
echo.
echo ========================================
echo  Сервер запущен на:
echo  http://127.0.0.1:8000
echo  Документация: http://127.0.0.1:8000/docs
echo  Нажмите Ctrl+C для остановки
echo ========================================
echo.
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

pause