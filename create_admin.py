import os
import psycopg2
from passlib.context import CryptContext

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("Ошибка: Укажите DATABASE_URL в переменных окружения")
    print("Пример для Windows (PowerShell):")
    print('  $env:DATABASE_URL="postgresql://..."')
    print("Пример для Windows (CMD):")
    print('  set DATABASE_URL=postgresql://...')
    exit(1)

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
hashed_password = pwd_context.hash("123456")
print(f"Хэш пароля: {hashed_password}")

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p79040548_accounting_automatio")

try:
    # Создаём пользователя (или обновляем баланс, если уже существует)
    cur.execute(f"""
        INSERT INTO {SCHEMA}.users (email, hashed_password, balance, created_at)
        VALUES (%s, %s, %s, NOW())
        ON CONFLICT (email) DO UPDATE
        SET balance = EXCLUDED.balance,
            hashed_password = EXCLUDED.hashed_password,
            updated_at = NOW()
        RETURNING id, email, balance
    """, ("Denittt@yandex.ru", hashed_password, 1000))
    row = cur.fetchone()
    conn.commit()
    print(f"\n✅ Администратор создан/обновлён!")
    print(f"   ID: {row[0]}")
    print(f"   Email: {row[1]}")
    print(f"   Баланс: {row[2]} запросов")
except Exception as e:
    conn.rollback()
    print(f"\n❌ Ошибка: {e}")
finally:
    cur.close()
    conn.close()

print("\nТеперь вы можете войти на сайт:")
print("  Email: Denittt@yandex.ru")
print("  Пароль: 123456")
print("\nНажмите кнопку «Войти» в правом верхнем углу.")