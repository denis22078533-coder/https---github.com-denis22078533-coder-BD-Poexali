"""
Настройки базы данных: проверка, миграции.
GET  /           — статус (подключение, таблицы, миграции)
POST /           — действие: migrate | test | configure | install
"""
import json
import os
import glob
import sys
import subprocess

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import psycopg2

# Импортируем db_config для сохранения DATABASE_URL
from db_config import save_config, load_config

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
API_DIR = os.path.dirname(BASE_DIR)
PROJECT_DIR = os.path.dirname(API_DIR)
MIGRATIONS_DIR = os.path.join(PROJECT_DIR, "db_migrations")
SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p79040548_accounting_automatio")


def get_db_url() -> str:
    """Возвращает DATABASE_URL: сначала из db_config.json, потом из env."""
    # Проверяем db_config.json
    try:
        config_path = os.path.join(API_DIR, "db_config.json")
        if os.path.exists(config_path):
            with open(config_path, "r") as f:
                config = json.load(f)
            if config.get("database_url"):
                return config["database_url"]
    except Exception:
        pass
    # Fallback на переменную окружения
    return os.environ.get("DATABASE_URL", "")


def resp(status, body):
    return {"statusCode": status, "headers": CORS, "body": json.dumps(body, ensure_ascii=False, default=str)}


def get_full_status() -> dict:
    """Подробный статус PostgreSQL и таблиц."""
    url = get_db_url()

    # Базовые поля для совместимости с UI
    status = {
        "installed": False,
        "running": False,
        "configured": bool(url),
        "connected": False,
        "schema_exists": False,
        "tables_count": 0,
        "tables": [],
        "migrations_applied": 0,
        "migration_files": [],
        "migrations_total": 0,
    }

    if not url:
        status["error"] = "DATABASE_URL не задан"
        return status

    # Проверяем, установлен ли PostgreSQL на сервере
    try:
        result = subprocess.run(
            ["pg_isready", "-q"],
            capture_output=True,
            timeout=5,
        )
        status["running"] = result.returncode == 0
    except Exception:
        status["running"] = False

    # Проверяем наличие pg_config/postgres в системе
    try:
        subprocess.run(["pg_config", "--version"], capture_output=True, timeout=5)
        status["installed"] = True
    except Exception:
        # Если psycopg2 подключился, значит PostgreSQL всё же доступен
        status["installed"] = False

    try:
        conn = psycopg2.connect(url, connect_timeout=10)
        cur = conn.cursor()

        cur.execute("SELECT version()")
        status["version"] = cur.fetchone()[0]
        status["connected"] = True

        # Если удалось подключиться — значит сервер БД работает
        if not status["installed"]:
            status["installed"] = True
        if not status["running"]:
            status["running"] = True

        # Проверяем таблицы в схеме MAIN_DB_SCHEMA (или public если не задана)
        check_schema = os.environ.get("MAIN_DB_SCHEMA", "public")
        cur.execute("""
            SELECT COUNT(*) FROM information_schema.tables
            WHERE table_schema = %s AND table_type = 'BASE TABLE'
        """, (check_schema,))
        status["tables_count"] = cur.fetchone()[0]
        status["current_schema"] = check_schema

        cur.execute("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = %s AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """, (check_schema,))
        status["tables"] = [r[0] for r in cur.fetchall()]

        status["schema_exists"] = status["tables_count"] > 0

        # Миграции
        try:
            cur.execute("SELECT COUNT(*) FROM _migrations")
            status["migrations_applied"] = cur.fetchone()[0]
        except Exception:
            status["migrations_applied"] = 0

        cur.close()
        conn.close()
    except Exception as e:
        status["connected"] = False
        status["connection_error"] = str(e)

    # Список файлов миграций
    migration_files = []
    if os.path.isdir(MIGRATIONS_DIR):
        migration_files = sorted(
            os.path.basename(f) for f in glob.glob(os.path.join(MIGRATIONS_DIR, "V*.sql"))
        )
    status["migration_files"] = migration_files
    status["migrations_total"] = len(migration_files)

    return status


def run_migrations() -> dict:
    """Запускает SQL-миграции из db_migrations/ по порядку."""
    url = get_db_url()
    if not url:
        return {"ok": False, "error": "DATABASE_URL не задан"}

    if not os.path.isdir(MIGRATIONS_DIR):
        return {"ok": False, "error": f"Папка миграций не найдена: {MIGRATIONS_DIR}"}

    migration_files = sorted(glob.glob(os.path.join(MIGRATIONS_DIR, "V*.sql")))
    if not migration_files:
        return {"ok": False, "error": "Нет файлов миграций"}

    applied_count = 0
    errors = []

    try:
        conn = psycopg2.connect(url, connect_timeout=10)
        cur = conn.cursor()

        # Создаём таблицу для отслеживания применённых миграций
        cur.execute("""
            CREATE TABLE IF NOT EXISTS _migrations (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL UNIQUE,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.commit()

        for mf in migration_files:
            filename = os.path.basename(mf)

            # Проверяем, не применялась ли уже
            cur.execute("SELECT 1 FROM _migrations WHERE filename = %s", (filename,))
            if cur.fetchone():
                continue

            try:
                with open(mf, "r") as f:
                    sql = f.read()

                cur.execute(sql)
                conn.commit()

                cur.execute("INSERT INTO _migrations (filename) VALUES (%s)", (filename,))
                conn.commit()

                applied_count += 1
            except Exception as e:
                conn.rollback()
                errors.append(f"{filename}: {str(e)}")

        cur.close()
        conn.close()

        return {
            "ok": len(errors) == 0,
            "applied": applied_count,
            "total": len(migration_files),
            "errors": errors,
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")

    if method == "GET":
        status = get_full_status()
        return resp(200, status)

    if method == "POST":
        body = json.loads(event.get("body") or "{}")
        action = body.get("action", "")

        if action == "migrate":
            result = run_migrations()
            return resp(200 if result.get("ok") else 500, result)

        if action == "test":
            url = get_db_url()
            if not url:
                return resp(400, {"ok": False, "error": "DATABASE_URL не задан"})
            try:
                conn = psycopg2.connect(url, connect_timeout=5)
                cur = conn.cursor()
                cur.execute("SELECT 1")
                cur.close()
                conn.close()
                return resp(200, {"ok": True, "message": "Подключение успешно"})
            except Exception as e:
                return resp(500, {"ok": False, "error": str(e)})

        if action == "configure":
            database_url = body.get("database_url", "").strip()
            if not database_url:
                return resp(400, {"ok": False, "error": "database_url не может быть пустым"})
            try:
                # Сохраняем URL через db_config (в БД, а если не получится — в JSON-файл)
                save_config({"database_url": database_url})
                # Принудительно обновляем os.environ для текущего запроса
                os.environ["DATABASE_URL"] = database_url
                return resp(200, {"ok": True, "message": "DATABASE_URL сохранён"})
            except Exception as e:
                return resp(500, {"ok": False, "error": str(e)})

        if action == "install":
            # Установка PostgreSQL на сервере (только для Linux)
            steps = []
            try:
                import shutil
                if shutil.which("psql") or shutil.which("pg_isready"):
                    steps.append("PostgreSQL уже установлен")
                    return resp(200, {"ok": True, "steps": steps, "message": "PostgreSQL уже установлен"})

                # Пытаемся установить
                try:
                    if os.name == "posix":
                        # Ubuntu/Debian
                        result = subprocess.run(
                            ["apt-get", "update", "-qq"],
                            capture_output=True, timeout=60
                        )
                        steps.append("apt update выполнен")

                        result = subprocess.run(
                            ["apt-get", "install", "-y", "-qq", "postgresql", "postgresql-contrib"],
                            capture_output=True, timeout=120
                        )
                        if result.returncode == 0:
                            steps.append("PostgreSQL установлен")
                        else:
                            return resp(500, {"ok": False, "error": f"Ошибка установки: {result.stderr.decode()}", "steps": steps})

                        # Запускаем PostgreSQL
                        subprocess.run(
                            ["pg_ctlcluster", "16", "main", "start"],
                            capture_output=True, timeout=30
                        )
                        steps.append("PostgreSQL запущен")

                        # Создаём пользователя и базу
                        subprocess.run(
                            ["su", "-", "postgres", "-c", "psql -c \"CREATE USER accounting WITH PASSWORD 'accounting';\""],
                            capture_output=True, timeout=30
                        )
                        steps.append("Пользователь accounting создан")

                        subprocess.run(
                            ["su", "-", "postgres", "-c", "psql -c \"CREATE DATABASE accounting OWNER accounting;\""],
                            capture_output=True, timeout=30
                        )
                        steps.append("База данных accounting создана")

                        # Формируем DATABASE_URL
                        local_url = "postgresql://accounting:accounting@localhost:5432/accounting"

                        # Сохраняем
                        config_file = os.path.join(API_DIR, "db_config.json")
                        with open(config_file, "w") as f:
                            json.dump({"database_url": local_url}, f, indent=2)
                        os.environ["DATABASE_URL"] = local_url
                        steps.append("DATABASE_URL сохранён в конфиг")

                        # Маскируем пароль для вывода
                        masked_url = local_url.replace("accounting:accounting@", "accounting:****@")

                        return resp(200, {
                            "ok": True,
                            "steps": steps,
                            "database_url_masked": masked_url,
                            "message": "PostgreSQL установлен и настроен"
                        })
                    else:
                        return resp(500, {"ok": False, "error": "Автоматическая установка поддерживается только на Linux", "steps": steps})
                except Exception as e:
                    return resp(500, {"ok": False, "error": str(e), "steps": steps})
            except Exception as e:
                return resp(500, {"ok": False, "error": str(e), "steps": steps})

        return resp(400, {"ok": False, "error": f"Неизвестное действие: {action}"})

    return resp(405, {"error": "Method not allowed"})
