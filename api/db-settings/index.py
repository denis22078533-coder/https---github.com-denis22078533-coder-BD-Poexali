"""
Настройки базы данных: проверка, установка, миграции.
GET  /           — статус (установлен ли PostgreSQL, запущен ли, есть ли БД)
POST /           — действие: install | configure | migrate

Действия:
  install   — установить PostgreSQL через apt, создать пользователя и БД
  configure — сохранить DATABASE_URL (если БД внешняя)
  migrate   — запустить все миграции из db_migrations/
"""
import json
import os
import subprocess
import sys
import glob

import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p79040548_accounting_automatio")
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
API_DIR = os.path.dirname(BASE_DIR)  # /root/app/api
PROJECT_DIR = os.path.dirname(API_DIR)  # /root/app
MIGRATIONS_DIR = os.path.join(PROJECT_DIR, "db_migrations")

# Подключаем наш helper
sys.path.insert(0, API_DIR)
from db_config import load_config, save_config, get_db_url, get_status as get_db_status


def resp(status, body):
    return {"statusCode": status, "headers": CORS, "body": json.dumps(body, ensure_ascii=False, default=str)}


def check_postgresql_installed() -> bool:
    """Проверяет, установлен ли PostgreSQL."""
    try:
        result = subprocess.run(
            ["pg_config", "--version"],
            capture_output=True, text=True, timeout=10
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def check_postgresql_running() -> bool:
    """Проверяет, запущен ли сервис PostgreSQL."""
    try:
        result = subprocess.run(
            ["systemctl", "is-active", "postgresql"],
            capture_output=True, text=True, timeout=10
        )
        return result.stdout.strip() == "active"
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


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

                # Выполняем SQL
                cur.execute(sql)
                conn.commit()

                # Отмечаем как выполненную
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


def install_postgresql() -> dict:
    """Устанавливает PostgreSQL, создаёт пользователя и БД."""
    steps = []

    try:
        # Шаг 1: apt update
        steps.append("apt update…")
        subprocess.run(["apt", "update"], capture_output=True, text=True, timeout=120)

        # Шаг 2: установка PostgreSQL
        steps.append("Установка PostgreSQL…")
        result = subprocess.run(
            ["apt", "install", "-y", "postgresql", "postgresql-contrib"],
            capture_output=True, text=True, timeout=180
        )
        if result.returncode != 0:
            return {"ok": False, "steps": steps, "error": f"Ошибка установки: {result.stderr[:500]}"}

        # Шаг 3: запуск сервиса
        steps.append("Запуск PostgreSQL…")
        subprocess.run(["systemctl", "enable", "postgresql"], capture_output=True, text=True, timeout=15)
        subprocess.run(["systemctl", "start", "postgresql"], capture_output=True, text=True, timeout=15)

        # Шаг 4: проверка, что запустился
        import time
        time.sleep(2)
        if not check_postgresql_running():
            return {"ok": False, "steps": steps, "error": "PostgreSQL не запустился"}

        # Шаг 5: создаём пользователя и БД
        steps.append("Создание пользователя и БД…")
        db_name = "accounting"
        db_user = "accounting"
        db_pass = "hDxsiKNSlsr6dMMe"

        # Создаём пользователя (если не существует)
        subprocess.run(
            ["sudo", "-u", "postgres", "psql", "-c",
             f"CREATE USER {db_user} WITH PASSWORD '{db_pass}';"],
            capture_output=True, text=True, timeout=10
        )

        # Создаём БД (если не существует)
        subprocess.run(
            ["sudo", "-u", "postgres", "psql", "-c",
             f"CREATE DATABASE {db_name} OWNER {db_user};"],
            capture_output=True, text=True, timeout=10
        )

        # Даём права
        subprocess.run(
            ["sudo", "-u", "postgres", "psql", "-c",
             f"GRANT ALL PRIVILEGES ON DATABASE {db_name} TO {db_user};"],
            capture_output=True, text=True, timeout=10
        )

        # Создаём схему
        subprocess.run(
            ["sudo", "-u", "postgres", "psql", "-d", db_name, "-c",
             f"CREATE SCHEMA IF NOT EXISTS {SCHEMA};"],
            capture_output=True, text=True, timeout=10
        )
        subprocess.run(
            ["sudo", "-u", "postgres", "psql", "-d", db_name, "-c",
             f"GRANT ALL ON SCHEMA {SCHEMA} TO {db_user};"],
            capture_output=True, text=True, timeout=10
        )
        subprocess.run(
            ["sudo", "-u", "postgres", "psql", "-d", db_name, "-c",
             f"GRANT ALL ON ALL TABLES IN SCHEMA {SCHEMA} TO {db_user};"],
            capture_output=True, text=True, timeout=10
        )

        # Настраиваем pg_hba.conf для password auth
        steps.append("Настройка доступа…")
        pg_hba = subprocess.run(
            ["sudo", "-u", "postgres", "psql", "-t", "-c", "SHOW hba_file"],
            capture_output=True, text=True, timeout=10
        ).stdout.strip()

        if pg_hba:
            # Меняем метод аутентификации с peer на md5 для локальных подключений
            subprocess.run(
                ["sed", "-i", r's/local\s\+all\s\+all\s\+peer/local   all             all                                     md5/', pg_hba],
                capture_output=True, text=True, timeout=10
            )
            subprocess.run(
                ["sed", "-i", r's/local\s\+all\s\+postgres\s\+peer/local   all             postgres                                peer/', pg_hba],
                capture_output=True, text=True, timeout=10
            )
            subprocess.run(["systemctl", "reload", "postgresql"], capture_output=True, text=True, timeout=15)

        # Формируем DATABASE_URL
        database_url = f"postgresql://{db_user}:{db_pass}@localhost:5432/{db_name}"

        # Сохраняем в конфиг
        save_config({"database_url": database_url, "installed": True})

        steps.append(f"Готово! DATABASE_URL сохранён")

        return {
            "ok": True,
            "steps": steps,
            "database_url_masked": f"postgresql://{db_user}:●●●●●●●●@localhost:5432/{db_name}",
        }

    except subprocess.TimeoutExpired as e:
        return {"ok": False, "steps": steps, "error": f"Таймаут: {str(e)[:200]}"}
    except Exception as e:
        return {"ok": False, "steps": steps, "error": str(e)}


def get_full_status() -> dict:
    """Подробный статус PostgreSQL и БД."""
    installed = check_postgresql_installed()
    running = check_postgresql_running() if installed else False
    url = get_db_url()

    status = {
        "installed": installed,
        "running": running,
        "configured": bool(url),
    }

    if url:
        try:
            conn = psycopg2.connect(url, connect_timeout=5)
            cur = conn.cursor()

            cur.execute("SELECT version()")
            status["version"] = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = %s", (SCHEMA,))
            status["schema_exists"] = cur.fetchone()[0] > 0

            if status["schema_exists"]:
                cur.execute(f"""
                    SELECT COUNT(*) FROM information_schema.tables
                    WHERE table_schema = %s AND table_type = 'BASE TABLE'
                """, (SCHEMA,))
                status["tables_count"] = cur.fetchone()[0]

                # Список таблиц
                cur.execute(f"""
                    SELECT table_name FROM information_schema.tables
                    WHERE table_schema = %s AND table_type = 'BASE TABLE'
                    ORDER BY table_name
                """, (SCHEMA,))
                status["tables"] = [r[0] for r in cur.fetchall()]

            # Миграции
            try:
                cur.execute("SELECT COUNT(*) FROM _migrations")
                status["migrations_applied"] = cur.fetchone()[0]
            except Exception:
                status["migrations_applied"] = 0

            cur.close()
            conn.close()
            status["connected"] = True
        except Exception as e:
            status["connected"] = False
            status["connection_error"] = str(e)

    # Список миграций
    migration_files = []
    if os.path.isdir(MIGRATIONS_DIR):
        migration_files = sorted(
            os.path.basename(f) for f in glob.glob(os.path.join(MIGRATIONS_DIR, "V*.sql"))
        )
    status["migration_files"] = migration_files
    status["migrations_total"] = len(migration_files)

    return status


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

        if action == "install":
            result = install_postgresql()
            return resp(200 if result.get("ok") else 500, result)

        if action == "configure":
            database_url = body.get("database_url", "")
            if not database_url:
                return resp(400, {"ok": False, "error": "database_url обязателен"})
            save_config({"database_url": database_url})
            return resp(200, {"ok": True, "message": "DATABASE_URL сохранён"})

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
