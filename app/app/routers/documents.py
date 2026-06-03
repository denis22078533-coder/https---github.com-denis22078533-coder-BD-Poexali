import uuid
import os
import json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request, Response
from sqlalchemy.orm import Session
from ..auth import get_db, get_current_user
from ..models import Document, User, Setting
from ..schemas import DocumentResponse

router = APIRouter(prefix="/documents", tags=["documents"])
UPLOAD_DIR = "uploads"
def get_guest_free_limit(db: Session) -> int:
    """Читает лимит бесплатных запросов для гостей из таблицы _settings."""
    row = db.query(Setting).filter(Setting.key == "guest_free_limit").first()
    return int(row.value) if row and row.value else 5

FREE_LIMIT = 5

def get_session_id(request: Request) -> str:
    session_id = request.cookies.get("session_id")
    if not session_id:
        session_id = str(uuid.uuid4())
    return session_id

@router.post("/upload")
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)   # если токен передан – пользователь авторизован
):
    # Если пользователь авторизован – списываем кредит
    if current_user:
        if current_user.balance < 1:
            raise HTTPException(status_code=402, detail="Недостаточно средств. Пополните баланс.")
        current_user.balance -= 1
        db.commit()
        owner_id = current_user.id
        session_id = None
    else:
        # Неавторизованный: проверяем лимит по session_id
        session_id = get_session_id(request)
        free_limit = get_guest_free_limit(db)
        count = db.query(Document).filter(Document.session_id == session_id).count()
        if count >= free_limit:
            raise HTTPException(
                status_code=403,
                detail="Бесплатные попытки закончились. Зарегистрируйтесь и пополните баланс."
            )
        owner_id = None

    # Сохраняем файл
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    unique_name = f"{uuid.uuid4()}_{file.filename}"
    filepath = os.path.join(UPLOAD_DIR, unique_name)
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    doc = Document(
        user_id=owner_id,
        session_id=session_id,
        filename=file.filename,
        filepath=filepath
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Сохраняем session_id в cookie, чтобы лимит работал
    response = Response(
        json.dumps(DocumentResponse(id=doc.id, filename=doc.filename, created_at=str(doc.created_at)).dict()),
        media_type="application/json",
    )
    if session_id:
        response.set_cookie(
            key="session_id",
            value=session_id,
            max_age=86400 * 30,  # 30 дней
            httponly=True,
            samesite="lax",
            path="/",
        )
    return response