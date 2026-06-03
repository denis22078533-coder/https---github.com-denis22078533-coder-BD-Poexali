@echo off
cd /d "%~dp0"
cd doc-service
call venv\Scripts\activate.bat
echo Регистрируем пользователя test@example.com...
python -c "import requests; resp = requests.post('http://127.0.0.1:8000/api/auth/register', json={'email':'test@example.com','password':'secret123'}); print('Ответ:', resp.status_code, resp.text if resp.ok else resp.json())"
pause