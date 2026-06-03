@echo off
chcp 65001 > nul

:: Переходим в папку doc-service
pushd "%~dp0doc-service"

:: Активируем виртуальное окружение
call "venv\Scripts\activate.bat"

echo Регистрируем пользователя test@example.com...
:: Выполняем HTTP-запрос к эндпоинту регистрации
python -c ^"import requests; resp = requests.post(\"http://127.0.0.1:8000/api/auth/register\", json={\"email\":\"test@example.com\",\"password\":\"secret123\"}); print(f\"Status: {resp.status_code}\"); print(resp.text)^"

:: Возвращаемся в исходную папку
popd

pause