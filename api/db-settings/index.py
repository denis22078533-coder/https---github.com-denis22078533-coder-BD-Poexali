"""
Настройки базы данных: проверка, миграции.
GET  /           — статус (подключение, таблицы, миграции)
POST /           — действие: migrate | test
"""
import json
import os
import glob
import psycopg2

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
    return os.environ.get("DATABASE_URL", "")


def resp(status, body):
    return {"statusCode": status, "headers": CORS, "body": json.dumps(body, ensure_ascii=False, default=str)}


def get_full_status() -> dict:
    """Подробный статус PostgreSQL и таблиц."""
    url = get_db_url()
    if not url:
        return {
            "configured": False,
            "connected": False,
            "error": "DATABASE_URL не задан",
        }

    status = {"configured": True}

    try:
        conn = psycopg2.connect(url, connect_timeout=10)
        cur = conn.cursor()

        cur.execute("SELECT version()")
        status["version"] = cur.fetchone()[0]

        cur.execute("SELECT 1")
        status["connected"] = True

        # Проверяем таблицы
        cur.execute("""
            SELECT COUNT(*) FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        """)
        status["tables_count"] = cur.fetchone()[0]

        cur.execute("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """)
        status["tables"] = [r[0] for r in cur.fetchall()]

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

        return resp(400, {"ok": False, "error": f"Неизвестное действие: {action}"})

    return resp(405, {"error": "Method not allowed"})
