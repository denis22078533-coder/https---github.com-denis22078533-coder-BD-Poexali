import os
import sys

# Добавляем путь к корню проекта, чтобы импортировать app/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Устанавливаем DATABASE_URL (как в api/index.py)
SUPABASE_URL = "postgresql://postgres.pmsecgerqlqfkwnhmyvn:RuRHQKzPv9y4yRAS@aws-0-eu-west-1.pooler.supabase.com:6543/postgres"
os.environ["DATABASE_URL"] = SUPABASE_URL
os.environ["VERCEL"] = "1"

from app.app.database import SessionLocal
from app.app.auth import hash_password
from app.app.models import User

def reset_password(email: str, new_password: str):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"❌ Пользователь с email '{email}' не найден")
            return False
        
        user.hashed_password = hash_password(new_password)
        db.commit()
        print(f"✅ Пароль для {email} успешно сброшен на '{new_password}'")
        return True
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        return False
    finally:
        db.close()

if __name__ == "__main__":
    email = "denittt@yandex.ru"
    new_password = "Test1234"
    reset_password(email, new_password)