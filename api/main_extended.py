"""
Дополненный FastAPI-сервер с простой регистрацией без БД.
"""

# Импорт основной части
from .main import app
from pydantic import BaseModel

# Простейшая регистрация без базы данных
class SimpleRegisterRequest(BaseModel):
    email: str
    password: str

class SimpleRegisterResponse(BaseModel):
    message: str
    email: str

@app.post("/api/simple-register", response_model=SimpleRegisterResponse)
async def simple_register(req: SimpleRegisterRequest):
    # Здесь можно сохранить в память или лог
    return SimpleRegisterResponse(message="Пользователь зарегистрирован", email=req.email)