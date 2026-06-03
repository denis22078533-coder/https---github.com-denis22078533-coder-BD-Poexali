@echo off
chcp 65001 > nul

rem — Переходим в папку doc-service независимо от пробелов или кириллицы в пути
pushd "%~dp0doc-service"

if not exist "venv" (
    echo Виртуальное окружение не найдено!
    echo Запустите install_backend.bat сначала
    pause
    popd
    exit /b 1
)

rem — Активируем виртуальное окружение
call "venv\Scripts\activate.bat"

echo.
echo ========================================
echo  Сервер запущен на:
echo  http://127.0.0.1:8000
echo  Документация: http://127.0.0.1:8000/docs
echo  Нажмите Ctrl+C для остановки
echo ========================================
echo.

rem — Запуск FastAPI через uvicorn
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

rem — Возвращаемся в исходную папку после остановки
popd
pause