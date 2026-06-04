"""
Единый FastAPI-сервер для бэкенда бухгалтерии.
Объединяет все модули (upload-doc, recognize-doc, ai-settings, ai-chat,
categories, docs-pdf, documents, generate-pdf, img-proxy, s3-settings,
tax-reports, transactions) в один работающий веб-сервер через uvicorn.

Запуск:
    uvicorn main:app --host 0.0.0.0 --port 8000
"""

import json
import os
import importlib.util
import sys
from typing import Optional
from fastapi import FastAPI, Request, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ─── Добавляем путь к корню проекта, чтобы импортировать app/ ──────────────
PROJECT_ROOT = os.path.dirname(BASE_DIR)
sys.path.insert(0, PROJECT_ROOT)

# ──────────────────────────────────────────────────────────────────────────────
# Настройки окружения (DATABASE_URL задаётся в api/index.py)
# ──────────────────────────────────────────────────────────────────────────────
SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p79040548_accounting_automatio")
DATABASE_URL = os.environ.get("DATABASE_URL", "")

app = FastAPI(
    title="Бухгалтерия API",
    description="Единый API-сервер для управления документами, транзакциями, отчётами и ИИ",
    version="1.0.0",
)

# ─── Подключаем роутер аутентификации ───────────────────────────────────────
try:
    from app.app.routers.auth import router as auth_router
    app.include_router(auth_router, prefix="/api")
    print("[main] Auth router connected")
except Exception as e:
    print(f"[main] Failed to load auth router: {e}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────────────────────────────────────
# Вспомогательная функция: конвертация Yandex Cloud Functions event → FastAPI
# ──────────────────────────────────────────────────────────────────────────────
def build_event(request: Request) -> dict:
    """Строит event-словарь, совместимый с оригинальными Yandex Cloud Functions handler-ами."""
    event = {
        "httpMethod": request.method,
        "path": request.url.path,
        "headers": dict(request.headers),
        "queryStringParameters": dict(request.query_params),
        "body": None,
        "isBase64Encoded": False,
    }
    try:
        body_bytes = request.state.body_bytes
    except AttributeError:
        return event
    if body_bytes:
        # Проверяем base64
        try:
            body_str = body_bytes.decode("utf-8")
        except UnicodeDecodeError:
            body_str = base64.b64encode(body_bytes).decode("utf-8")
            event["isBase64Encoded"] = True
        event["body"] = body_str
    return event


# ──────────────────────────────────────────────────────────────────────────────
# Импорт всех модулей (каждый должен экспортировать функцию handler(event, context))
# ──────────────────────────────────────────────────────────────────────────────

def load_module(module_name: str, file_path: str):
    """Загружает Python-модуль из указанного пути."""
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = mod
    spec.loader.exec_module(mod)
    return mod


# ─── Lazy-загрузка модулей: при старте не загружаем, только при первом запросе ─
_module_cache: dict[str, object] = {}
_module_paths: dict[str, str] = {}

# Определяем пути ко всем модулям (без загрузки)
module_paths: dict[str, str] = {
    "upload_doc": os.path.join(BASE_DIR, "upload-doc", "index.py"),
    "recognize_doc": os.path.join(BASE_DIR, "recognize-doc", "index.py"),
    "ai_settings": os.path.join(BASE_DIR, "ai-settings", "index.py"),
    "ai_chat": os.path.join(BASE_DIR, "ai-chat", "index.py"),
    "categories": os.path.join(BASE_DIR, "categories", "index.py"),
    "docs_pdf": os.path.join(BASE_DIR, "docs-pdf", "index.py"),
    "documents": os.path.join(BASE_DIR, "documents", "index.py"),
    "generate_pdf": os.path.join(BASE_DIR, "generate-pdf", "index.py"),
    "img_proxy": os.path.join(BASE_DIR, "img-proxy", "index.py"),
    "s3_settings": os.path.join(BASE_DIR, "s3-settings", "index.py"),
    "tax_reports": os.path.join(BASE_DIR, "tax-reports", "index.py"),
    "transactions": os.path.join(BASE_DIR, "transactions", "index.py"),
    "db_settings": os.path.join(BASE_DIR, "db-settings", "index.py"),
}

def get_module(module_key: str):
    """Ленивая загрузка модуля: грузим только при первом обращении."""
    if module_key not in _module_cache:
        file_path = module_paths.get(module_key)
        if not file_path or not os.path.exists(file_path):
            raise ImportError(f"Module {module_key} not found at {file_path}")
        try:
            _module_cache[module_key] = load_module(module_key, file_path)
            print(f"[main] Loaded module: {module_key}")
        except Exception as e:
            import traceback
            print(f"[main] Failed to load {module_key}: {e}")
            print(traceback.format_exc())
            raise
    return _module_cache[module_key]

# ──────────────────────────────────────────────────────────────────────────────
# Middleware: сохраняем body в state
# ──────────────────────────────────────────────────────────────────────────────
@app.middleware("http")
async def capture_body(request: Request, call_next):
    body = await request.body()
    request.state.body_bytes = body
    response = await call_next(request)
    return response


# ──────────────────────────────────────────────────────────────────────────────
# Универсальная прослойка: вызывает handler(event, context) модуля
# ──────────────────────────────────────────────────────────────────────────────
async def call_module_handler(request: Request, module_key: str):
    try:
        mod = get_module(module_key)
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"[main] Error loading module {module_key}: {error_detail}")
        return Response(
            content=json.dumps({"error": f"Module {module_key} not found: {str(e)}"}),
            status_code=500,
            media_type="application/json",
        )
    event = build_event(request)
    context = {}  # Пустой контекст (можно расширить при необходимости)

    try:
        result = mod.handler(event, context)
    except Exception as e:
        import traceback
        print(f"[main] Error in {module_key}: {traceback.format_exc()}")
        return Response(
            content=json.dumps({"error": str(e)}),
            status_code=500,
            media_type="application/json",
        )

    status_code = result.get("statusCode", 200)
    headers = result.get("headers", {})
    body = result.get("body", "")

    # Если тело — строка (JSON), отдаём как есть
    # Если base64-encoded — декодируем
    is_base64 = result.get("isBase64Encoded", False)

    if is_base64 and body:
        import base64
        body_bytes = base64.b64decode(body)
        media_type = headers.get("Content-Type", "application/octet-stream")
        return Response(content=body_bytes, status_code=status_code, headers=headers, media_type=media_type)
    else:
        media_type = headers.get("Content-Type", "application/json")
        return Response(content=body, status_code=status_code, headers=headers, media_type=media_type)


# ──────────────────────────────────────────────────────────────────────────────
# Маршруты — каждый эндпоинт проксируется в соответствующий handler
# ──────────────────────────────────────────────────────────────────────────────

@app.api_route("/api/upload-doc", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
async def upload_doc_endpoint(request: Request):
    return await call_module_handler(request, "upload_doc")


@app.api_route("/api/recognize-doc", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
async def recognize_doc_endpoint(request: Request):
    return await call_module_handler(request, "recognize_doc")


@app.api_route("/api/ai-settings", methods=["GET", "PUT", "OPTIONS"])
async def ai_settings_endpoint(request: Request):
    return await call_module_handler(request, "ai_settings")


@app.api_route("/api/ai-chat", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
async def ai_chat_endpoint(request: Request):
    return await call_module_handler(request, "ai_chat")


@app.api_route("/api/categories", methods=["GET", "POST", "DELETE", "OPTIONS"])
async def categories_endpoint(request: Request):
    return await call_module_handler(request, "categories")


@app.api_route("/api/docs-pdf", methods=["GET", "OPTIONS"])
async def docs_pdf_endpoint(request: Request):
    return await call_module_handler(request, "docs_pdf")


@app.api_route("/api/documents", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
async def documents_endpoint(request: Request):
    return await call_module_handler(request, "documents")


@app.api_route("/api/generate-pdf", methods=["GET", "OPTIONS"])
async def generate_pdf_endpoint(request: Request):
    return await call_module_handler(request, "generate_pdf")


@app.api_route("/api/img-proxy", methods=["GET", "OPTIONS"])
async def img_proxy_endpoint(request: Request):
    return await call_module_handler(request, "img_proxy")


@app.api_route("/api/s3-settings", methods=["GET", "PUT", "OPTIONS"])
async def s3_settings_endpoint(request: Request):
    return await call_module_handler(request, "s3_settings")


@app.api_route("/api/tax-reports", methods=["GET", "POST", "DELETE", "OPTIONS"])
async def tax_reports_endpoint(request: Request):
    return await call_module_handler(request, "tax_reports")


@app.api_route("/api/transactions", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
async def transactions_endpoint(request: Request):
    return await call_module_handler(request, "transactions")


@app.api_route("/api/db-settings", methods=["GET", "POST", "PUT", "OPTIONS"])
async def db_settings_endpoint(request: Request):
    return await call_module_handler(request, "db_settings")


# ──────────────────────────────────────────────────────────────────────────────
# Health check
# ──────────────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "schema": SCHEMA}


# ──────────────────────────────────────────────────────────────────────────────
# Точка входа
# ──────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        workers=4,
        log_level="info",
    )
