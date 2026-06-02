import os
import sys

# ─── Жёстко прописываем DATABASE_URL (Supabase) ─────────────
SUPABASE_URL = "postgresql://postgres.pmsecgerqlqfkwnhmyvn:RuRHQKzPv9y4yRAS@aws-0-eu-west-1.pooler.supabase.com:6543/postgres"
os.environ["DATABASE_URL"] = SUPABASE_URL
os.environ["VERCEL"] = "1"

# ─── Добавляем путь к модулям ───────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(BASE_DIR))  # корень проекта
sys.path.insert(0, BASE_DIR)                  # сама папка api

# ─── Пытаемся прочитать DATABASE_URL из таблицы _settings в БД ──
try:
    from db_config import load_config as _load_db_config
    _loaded = _load_db_config()
    if _loaded.get("database_url") and _loaded["database_url"] != SUPABASE_URL:
        os.environ["DATABASE_URL"] = _loaded["database_url"]
except Exception:
    pass

# ─── Импортируем FastAPI-приложение ─────────────────────────
from main import app

# ─── Mangum: адаптер FastAPI → Vercel Lambda ────────────────
try:
    from mangum import Mangum
    handler = Mangum(app)
except ImportError:
    # Fallback: если mangum не установлен, используем ASGI напрямую
    async def handler(scope, receive, send):
        await app(scope, receive, send)
