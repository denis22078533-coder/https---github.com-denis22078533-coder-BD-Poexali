from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..auth import get_db, hash_password, verify_password, create_access_token, get_current_user
from ..schemas import RegisterRequest, LoginRequest, TokenResponse, UserInfo
from ..models import User

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=TokenResponse)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == request.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed = hash_password(request.password)
    user = User(email=request.email, hashed_password=hashed)
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