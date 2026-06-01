"""
Vercel serverless entry point.
Обёртка над FastAPI-приложением из main.py для работы на Vercel.
"""
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
