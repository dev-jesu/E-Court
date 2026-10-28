import os
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr

from .auth import create_token, current_user_id, hash_password, verify_password
from .config import settings
from .admin import router as admin_router
from .db import db
from .llm import LANGUAGES, summarize

app = FastAPI(title="E-Court Document Summarizer")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin_router)


# ---------- schemas ----------
class RegisterIn(BaseModel):
    email: EmailStr
    full_name: str
    password: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class SummarizeIn(BaseModel):
    language: str = "en"


# ---------- helpers ----------
def _enrolled(user_id: str, case_id: str) -> bool:
    r = (db.table("case_enrollments").select("case_id")
         .eq("user_id", user_id).eq("case_id", case_id).execute())
    return bool(r.data)


def _get_doc_for_user(doc_id: str, user_id: str) -> dict:
    r = db.table("documents").select("*").eq("id", doc_id).execute()
    if not r.data or not _enrolled(user_id, r.data[0]["case_id"]):
        raise HTTPException(404, "Document not found")
    return r.data[0]


# ---------- auth ----------
@app.post("/auth/register")
def register(body: RegisterIn):
    if len(body.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if db.table("users").select("id").eq("email", body.email).execute().data:
        raise HTTPException(409, "Email already registered")
    u = db.table("users").insert({
        "email": body.email, "full_name": body.full_name,
        "password_hash": hash_password(body.password),
    }).execute().data[0]
    return {"access_token": create_token(u["id"]), "token_type": "bearer"}


@app.post("/auth/login")
def login(body: LoginIn):
    r = db.table("users").select("*").eq("email", body.email).execute()
    if not r.data or not verify_password(body.password, r.data[0]["password_hash"]):
        raise HTTPException(401, "Incorrect email or password")
    return {"access_token": create_token(r.data[0]["id"]), "token_type": "bearer"}


@app.get("/me")
def me(uid: str = Depends(current_user_id)):
    r = db.table("users").select("id,email,full_name,role").eq("id", uid).execute()
    if not r.data:
        raise HTTPException(401, "User not found")
    return r.data[0]


# ---------- workspace ----------
@app.get("/languages")
def languages():
    return LANGUAGES


@app.get("/cases")
def my_cases(uid: str = Depends(current_user_id)):
    r = db.table("case_enrollments").select("cases(*)").eq("user_id", uid).execute()
    return [row["cases"] for row in r.data]


@app.get("/cases/{case_id}/documents")
def case_documents(case_id: str, uid: str = Depends(current_user_id)):
    if not _enrolled(uid, case_id):
        raise HTTPException(404, "Case not found")
    r = (db.table("documents").select("id,title,language,created_at,file_path")
         .eq("case_id", case_id).order("created_at", desc=True).execute())
    return r.data


@app.get("/documents/{doc_id}")
def get_document(doc_id: str, uid: str = Depends(current_user_id)):
    return _get_doc_for_user(doc_id, uid)


@app.get("/documents/{doc_id}/pdf")
def view_document_pdf(doc_id: str, uid: str = Depends(current_user_id)):
    doc = _get_doc_for_user(doc_id, uid)
    file_path = doc.get("file_path")
    if not file_path:
        raise HTTPException(404, "No PDF file attached to this court document.")
    
    # Resolve absolute path
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    full_path = os.path.join(base_dir, file_path) if not os.path.isabs(file_path) else file_path
    
    if not os.path.exists(full_path):
        raise HTTPException(404, "Attached PDF file not found on server.")
    
    filename = os.path.basename(full_path)
    return FileResponse(
        path=full_path,
        media_type="application/pdf",
        filename=filename,
        content_disposition_type="inline"
    )


@app.post("/documents/{doc_id}/summarize")
async def summarize_doc(doc_id: str, body: SummarizeIn, uid: str = Depends(current_user_id)):
    if body.language not in LANGUAGES:
        raise HTTPException(400, "Unsupported language")
    doc = _get_doc_for_user(doc_id, uid)

    cached = (db.table("summaries").select("summary")
              .eq("document_id", doc_id).eq("language", body.language).execute())
    if cached.data:
        return {"summary": cached.data[0]["summary"], "cached": True}

    try:
        text = await summarize(doc["content"], body.language)
    except Exception:
        raise HTTPException(502, "Summarization service failed. Please try again.")

    db.table("summaries").upsert(
        {"document_id": doc_id, "language": body.language, "summary": text}
    ).execute()
    return {"summary": text, "cached": False}
