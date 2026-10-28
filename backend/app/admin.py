from io import BytesIO

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, EmailStr
from pypdf import PdfReader

from .auth import require_admin
from .db import db
from .llm import LANGUAGES

# every route in this router requires an admin
router = APIRouter(prefix="/admin", dependencies=[Depends(require_admin)])

MAX_UPLOAD = 10 * 1024 * 1024


class CaseIn(BaseModel):
    case_number: str
    title: str
    court: str | None = None


class DocIn(BaseModel):
    title: str
    language: str = "en"
    content: str


class EnrollIn(BaseModel):
    email: EmailStr


# ---------- cases ----------
@router.get("/cases")
def list_cases():
    return db.table("cases").select("*").order("created_at", desc=True).execute().data


@router.post("/cases")
def create_case(body: CaseIn):
    num = body.case_number.strip()
    if not num or not body.title.strip():
        raise HTTPException(400, "Case number and title are required")
    if db.table("cases").select("id").eq("case_number", num).execute().data:
        raise HTTPException(409, "A case with this number already exists")
    return db.table("cases").insert({
        "case_number": num, "title": body.title.strip(),
        "court": (body.court or "").strip() or None,
    }).execute().data[0]


@router.delete("/cases/{case_id}")
def delete_case(case_id: str):
    # documents, summaries and enrollments cascade
    db.table("cases").delete().eq("id", case_id).execute()
    return {"ok": True}


# ---------- documents ----------
@router.get("/cases/{case_id}/documents")
def list_documents(case_id: str):
    return (db.table("documents").select("id,title,language,created_at")
            .eq("case_id", case_id).order("created_at", desc=True).execute().data)


@router.post("/cases/{case_id}/documents")
def add_document(case_id: str, body: DocIn):
    if not body.title.strip() or not body.content.strip():
        raise HTTPException(400, "Title and content are required")
    if body.language not in LANGUAGES:
        raise HTTPException(400, "Unsupported language")
    if not db.table("cases").select("id").eq("id", case_id).execute().data:
        raise HTTPException(404, "Case not found")
    return db.table("documents").insert({
        "case_id": case_id, "title": body.title.strip(),
        "language": body.language, "content": body.content.strip(),
    }).execute().data[0]


@router.delete("/documents/{doc_id}")
def delete_document(doc_id: str):
    db.table("documents").delete().eq("id", doc_id).execute()
    return {"ok": True}


@router.post("/extract-text")
async def extract_text(file: UploadFile = File(...)):
    """Turn an uploaded .txt or text-based .pdf into plain text for the document form."""
    data = await file.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "File too large (max 10 MB)")
    name = (file.filename or "").lower()
    if name.endswith(".pdf"):
        try:
            reader = PdfReader(BytesIO(data))
            text = "\n\n".join((p.extract_text() or "") for p in reader.pages)
        except Exception:
            raise HTTPException(422, "Could not read this PDF")
    elif name.endswith(".txt"):
        text = data.decode("utf-8", errors="replace")
    else:
        raise HTTPException(415, "Only .pdf and .txt files are supported")
    if not text.strip():
        raise HTTPException(422, "No text found. Scanned PDFs need OCR first.")
    return {"text": text.strip()}


# ---------- enrollments ----------
@router.get("/cases/{case_id}/enrollments")
def list_enrollments(case_id: str):
    r = db.table("case_enrollments").select("users(id,email,full_name)").eq("case_id", case_id).execute()
    return [row["users"] for row in r.data]


@router.post("/cases/{case_id}/enrollments")
def enroll(case_id: str, body: EnrollIn):
    u = db.table("users").select("id,email,full_name").eq("email", body.email).execute().data
    if not u:
        raise HTTPException(404, "No registered user with that email. Ask them to register first.")
    db.table("case_enrollments").upsert({"user_id": u[0]["id"], "case_id": case_id}).execute()
    return u[0]


@router.delete("/cases/{case_id}/enrollments/{user_id}")
def unenroll(case_id: str, user_id: str):
    db.table("case_enrollments").delete().eq("case_id", case_id).eq("user_id", user_id).execute()
    return {"ok": True}
