"""
Загрузка/сохранение конфигурации БД из JSON-файла.
Позволяет менять DATABASE_URL без перезапуска через env.
"""
import json
import os

CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db_config.json")


def load_config():
    """Загружает db_config.json и прописывает DATABASE_URL в окружение."""
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r") as f:
                config = json.load(f)
            if config.get("database_url"):
                os.environ["DATABASE_URL"] = config["database_url"]
            return config
        except (json.JSONDecodeError, IOError):
            return {}
    return {}


def save_config(config: dict):
    """Сохраняет конфиг в JSON и обновляет os.environ."""
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    if config.get("database_url"):
        os.environ["DATABASE_URL"] = config["database_url"]


def get_db_url() -> str:
    """Возвращает DATABASE_URL из конфига или окружения."""
    # Сначала проверим конфиг
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r") as f:
                config = json.load(f)
            if config.get("database_url"):
                return config["database_url"]
        except Exception:
            pass
    # Fallback на переменную окружения
    return os.environ.get("DATABASE_URL", "")


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
        import psycopg2
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
