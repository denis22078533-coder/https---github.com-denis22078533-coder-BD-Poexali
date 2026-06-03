from fastapi import FastAPI
from .database import engine, Base
from .routers import auth, documents

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Document Service")
app.include_router(auth.router)
app.include_router(documents.router)

@app.get("/")
def root():
    return {"message": "Document Service is running"}