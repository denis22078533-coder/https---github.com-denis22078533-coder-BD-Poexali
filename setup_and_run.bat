@echo off
chcp 65001 >nul
title Установка и запуск сервера

cd /d "%~dp0doc-service"

echo ========================================
echo  Установка Python пакетов
echo ========================================
echo.

python -m pip install --upgrade pip 2>nul

echo Устанавливаю fastapi, uvicorn и другие компоненты...
echo Это может занять 1-2 минуты...
echo.

python -m pip install fastapi uvicorn sqlalchemy python-jose passlib bcrypt python-multipart requests

if %errorlevel% neq 0 (
    echo.
    echo ОШИБКА: Не удалось установить пакеты.
    echo.
    echo Возможные причины:
    echo 1. Python установлен из Microsoft Store - откройте Microsoft Store
    echo    найдите Python 3.11/3.12 и нажмите "Установить"
    echo 2. Нет подключения к интернету
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo  Запуск сервера
echo ========================================
echo.
echo Сервер будет доступен по адресу:
echo http://127.0.0.1:8000
echo.
echo Документация (проверить API):
echo http://127.0.0.1:8000/docs
echo.
echo НЕ ЗАКРЫВАЙТЕ ЭТО ОКНО
echo Нажмите Ctrl+C для остановки
echo ========================================
echo.

python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

pause