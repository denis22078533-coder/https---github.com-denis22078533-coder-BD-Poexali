from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from ..auth import get_db, hash_password, verify_password, create_access_token, get_current_user
from ..schemas import RegisterRequest, LoginRequest, TokenResponse, UserInfo
from ..models import User, Document, Setting
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])

FREE_LIMIT = 5

@router.post("/register", response_model=TokenResponse)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == request.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    # Читаем бонус при регистрации из таблицы _settings, по умолчанию 5
    bonus_row = db.query(Setting).filter(Setting.key == "registration_bonus").first()
    registration_bonus = int(bonus_row.value) if bonus_row and bonus_row.value else 5
    hashed = hash_password(request.password)
    user = User(email=request.email, hashed_password=hashed, balance=registration_bonus)
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(data={"sub": user.email})
    return TokenResponse(access_token=token)

@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(data={"sub": user.email})
    return TokenResponse(access_token=token)

@router.get("/me", response_model=UserInfo)
def get_me(user: User = Depends(get_current_user)):
    return UserInfo(email=user.email, balance=user.balance)

class RemainingResponse(BaseModel):
    remaining: int
    is_guest: bool

@router.get("/remaining", response_model=RemainingResponse)
def get_remaining(request: Request, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    if user:
        return RemainingResponse(remaining=user.balance, is_guest=False)
    else:
        session_id = request.cookies.get("session_id")
        if not session_id:
            return RemainingResponse(remaining=FREE_LIMIT, is_guest=True)
        count = db.query(Document).filter(Document.session_id == session_id).count()
        remaining = max(0, FREE_LIMIT - count)
        return RemainingResponse(remaining=remaining, is_guest=True)

class TopUpRequest(BaseModel):
    amount: int = 1

class TopUpResponse(BaseModel):
    new_balance: int

@router.post("/top-up", response_model=TopUpResponse)
def top_up_balance(request: TopUpRequest, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Требуется авторизация")
    user.balance += request.amount
    db.commit()
    db.refresh(user)
    return TopUpResponse(new_balance=user.balance)