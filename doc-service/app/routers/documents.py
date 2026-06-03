import uuid
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from sqlalchemy.orm import Session
from ..auth import get_db, get_current_user
from ..models import Document, User
from ..schemas import DocumentResponse

router = APIRouter(prefix="/documents", tags=["documents"])
UPLOAD_DIR = "uploads"
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
        count = db.query(Document).filter(Document.session_id == session_id).count()
        if count >= FREE_LIMIT:
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

    return DocumentResponse(id=doc.id, filename=doc.filename, created_at=str(doc.created_at))