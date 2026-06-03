@echo off
chcp 65001 >nul
cd /d "%~dp0doc-service"

echo ========================================
echo  Установка зависимостей бэкенда
echo ========================================

echo.
echo [1/4] Создание виртуального окружения...
python -m venv venv
if errorlevel 1 (
    echo Ошибка: Python не найден. Установите Python с python.org
    pause
    exit /b 1
)
echo   Готово

echo [2/4] Активация окружения...
call venv\Scripts\activate.bat
echo   Готово

echo [3/4] Установка пакетов...
pip install fastapi uvicorn sqlalchemy python-jose passlib[bcrypt] python-multipart
if errorlevel 1 (
    echo Ошибка при установке пакетов
    pause
    exit /b 1
)
echo   Готово

echo [4/4] Запуск сервера...
echo.
echo ========================================
echo  Сервер будет запущен на:
echo  http://127.0.0.1:8000
echo  Документация: http://127.0.0.1:8000/docs
echo ========================================
echo.
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

pause