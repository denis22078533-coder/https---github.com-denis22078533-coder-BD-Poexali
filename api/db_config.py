"""
Загрузка/сохранение конфигурации БД.
Позволяет менять DATABASE_URL без перезапуска.
Сначала пытается прочитать из таблицы _settings в самой БД.
Если БД ещё недоступна — использует переменную окружения или db_config.json.
"""
import json
import os
import psycopg2
import psycopg2.extras

# Путь к JSON-файлу (fallback, если БД недоступна)
CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db_config.json")


def _get_db_url_from_env_or_file() -> str:
    """Читает DATABASE_URL из os.environ или файла db_config.json."""
    url = os.environ.get("DATABASE_URL", "")
    if url:
        return url
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r") as f:
                config = json.load(f)
            return config.get("database_url", "")
        except Exception:
            pass
    return ""


def _get_db_url_from_db(current_url: str) -> str:
    """Пытается прочитать DATABASE_URL из таблицы _settings в БД."""
    if not current_url:
        return ""
    try:
        conn = psycopg2.connect(current_url, connect_timeout=5)
        cur = conn.cursor()
        cur.execute("SELECT value FROM _settings WHERE key = 'database_url'")
        row = cur.fetchone()
        cur.close()
        conn.close()
        if row and row[0]:
            return row[0]
    except Exception:
        pass
    return ""


def _save_db_url_to_db(url: str, old_url: str = "") -> bool:
    """Сохраняет DATABASE_URL в таблицу _settings в БД (UPSERT).
    
    Использует old_url для подключения, если он задан.
    Если old_url пустой — пытается подключиться через сам url.
    """
    connect_url = old_url or url
    if not connect_url:
        return False
    try:
        conn = psycopg2.connect(connect_url, connect_timeout=5)
        cur = conn.cursor()
        # Создаём таблицу _settings, если ещё нет
        cur.execute("""
            CREATE TABLE IF NOT EXISTS _settings (
                key VARCHAR(255) PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        cur.execute("""
            INSERT INTO _settings (key, value, updated_at)
            VALUES ('database_url', %s, NOW())
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        """, (url,))
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception:
        return False


def load_config():
    """Загружает конфиг из БД (или файла) и прописывает DATABASE_URL в окружение."""
    current_url = _get_db_url_from_env_or_file()
    db_url = _get_db_url_from_db(current_url) if current_url else ""
    final_url = db_url or current_url
    if final_url:
        os.environ["DATABASE_URL"] = final_url
    return {"database_url": final_url}


def save_config(config: dict):
    """Сохраняет DATABASE_URL: сначала пытается в БД, fallback на JSON-файл.
    
    ВАЖНО: на Vercel (serverless) файловая система read-only,
    поэтому запись в JSON-файл тихо игнорируется.
    """
    database_url = config.get("database_url", "")
    if not database_url:
        return

    # Обновляем os.environ для текущего запроса
    os.environ["DATABASE_URL"] = database_url

    # Запоминаем старый URL (из среды/файла) для подключения к БД
    old_url = _get_db_url_from_env_or_file()

    # Пытаемся сохранить в БД через старый URL (который уже работает)
    saved_to_db = False
    if old_url:
        saved_to_db = _save_db_url_to_db(database_url, old_url)

    if not saved_to_db:
        # Fallback: сохраняем в JSON (для VPS с файловой системой)
        # На Vercel это молча не сработает — read-only filesystem
        try:
            config_dir = os.path.dirname(CONFIG_PATH)
            if config_dir:
                os.makedirs(config_dir, exist_ok=True)
            with open(CONFIG_PATH, "w") as f:
                json.dump({"database_url": database_url}, f, indent=2, ensure_ascii=False)
        except (IOError, OSError):
            pass  # На Vercel файловая система read-only — игнорируем


def get_db_url() -> str:
    """Возвращает DATABASE_URL.
    
    Порядок поиска:
    1. Из таблицы _settings в БД (если БД доступна)
    2. Из os.environ
    3. Из db_config.json (fallback)
    """
    current_url = _get_db_url_from_env_or_file()
    if current_url:
        db_url = _get_db_url_from_db(current_url)
        if db_url:
            os.environ["DATABASE_URL"] = db_url
            return db_url

    url = os.environ.get("DATABASE_URL", "")
    if not url and os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r") as f:
                cfg = json.load(f)
            url = cfg.get("database_url", "")
            if url:
                os.environ["DATABASE_URL"] = url
        except Exception:
            pass
    return url or ""


def get_status() -> dict:
    """Возвращает статус подключения к БД."""
    url = get_db_url()
    configured = bool(url)

    if not configured:
        return {
            "configured": False,
            "database_url_set": False,
            "connected": False,
            "error": "DATABASE_URL не задан",
        }

    try:
        conn = psycopg2.connect(url, connect_timeout=5)
        cur = conn.cursor()
        cur.execute("SELECT version()")
        version = cur.fetchone()[0]
        cur.close()
        conn.close()
        return {
            "configured": True,
            "database_url_set": True,
            "connected": True,
            "version": version,
        }
    except Exception as e:
        return {
            "configured": True,
            "database_url_set": True,
            "connected": False,
            "error": str(e),
        }
