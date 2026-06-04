import os
import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Читаем DATABASE_URL: сначала из env, потом из db_config.json, потом SQLite по умолчанию
def get_database_url() -> str:
    # Из переменной окружения
    url = os.environ.get("DATABASE_URL", "")
    if url:
        return url
    
    # Из файла db_config.json в корне api/
    config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "api", "db_config.json")
    try:
        if os.path.exists(config_path):
            with open(config_path, "r") as f:
                config = json.load(f)
            if config.get("database_url"):
                return config["database_url"]
    except Exception:
        pass
    
    # По умолчанию SQLite
    return "sqlite:///./documents.db"

DATABASE_URL = get_database_url()

# Для PostgreSQL не нужен check_same_thread
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()