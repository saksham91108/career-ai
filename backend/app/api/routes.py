from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Request
from pydantic import BaseModel
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pypdf import PdfReader
from datetime import datetime, timedelta, timezone
from slowapi import Limiter
from slowapi.util import get_remote_address
import io
import json
import logging
import re

from app.services.chat_engine import ChatEngine
from app.services.parser import ResumeParser
from app.services.scorer import ResumeScorer
from app.services.feedback_engine import FeedbackEngine
from app.services.email_service import EmailService
from app.models.schemas import (
    AnalyzeRequest, AnalyzeResponse,
    RegisterRequest, HistoryResponse,
    ChatRequest, ChatResponse,
)
from app.db.database import get_db
from app.db.models import ResumeAnalysis, User, OTPStore
from app.core.security import (
    hash_password, verify_password,
    create_access_token, get_current_user,
)

logger = logging.getLogger(__name__)

parser = ResumeParser()
scorer = ResumeScorer()
feedback_engine = FeedbackEngine()
router = APIRouter()
chat_engine = ChatEngine()
email_service = EmailService()
limiter = Limiter(key_func=get_remote_address)


def _validate_password_strength(password: str):
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    if not re.search(r"[A-Z]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one lowercase letter.")
    if not re.search(r"\d", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number.")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one special character.")


# =========================
# SEND OTP
# =========================
@router.post("/auth/send-otp")
@limiter.limit("5/minute")
def send_otp(request: Request, payload: dict, db: Session = Depends(get_db)):
    email = payload.get("email", "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")

    if not re.match(r"^[\w\.-]+@[\w\.-]+\.\w{2,}$", email):
        raise HTTPException(status_code=400, detail="Invalid email address.")

    existing = db.query(User).filter(User.email == email).first()
    if existing and existing.is_verified:
        raise HTTPException(status_code=400, detail="Email already registered.")

    db.query(OTPStore).filter(OTPStore.email == email).delete()
    db.commit()

    otp = email_service.generate_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    otp_record = OTPStore(
        email=email,
        otp=otp,
        expires_at=expires_at,
        used=False,
    )
    db.add(otp_record)
    db.commit()

    sent = email_service.send_otp(email, otp)
    if not sent:
        raise HTTPException(status_code=500, detail="Failed to send OTP. Check your email address.")

    return {"message": "OTP sent successfully. Check your email."}


# =========================
# VERIFY OTP + REGISTER
# =========================
@router.post("/auth/verify-otp")
@limiter.limit("10/minute")
def verify_otp(request: Request, payload: dict, db: Session = Depends(get_db)):
    email = payload.get("email", "").strip().lower()
    otp = payload.get("otp", "").strip()
    password = payload.get("password", "")

    if not all([email, otp, password]):
        raise HTTPException(status_code=400, detail="Email, OTP and password are required.")

    _validate_password_strength(password)

    otp_record = (
        db.query(OTPStore)
        .filter(OTPStore.email == email, OTPStore.used == False)
        .order_by(OTPStore.created_at.desc())
        .first()
    )

    if not otp_record:
        raise HTTPException(status_code=400, detail="No OTP found. Please request a new one.")

    now = datetime.now(timezone.utc)
    expires = otp_record.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)

    if now > expires:
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")

    if otp_record.otp != otp:
        raise HTTPException(status_code=400, detail="Invalid OTP. Please try again.")

    otp_record.used = True
    db.commit()

    user = db.query(User).filter(User.email == email).first()
    if user:
        user.hashed_password = hash_password(password)
        user.is_verified = True
    else:
        user = User(
            email=email,
            hashed_password=hash_password(password),
            is_verified=True,
        )
        db.add(user)

    db.commit()
    db.refresh(user)

    token = create_access_token(data={"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}


# =========================
# LOGIN
# =========================
@router.post("/login")
@limiter.limit("10/minute")
def login_user(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == form_data.username.lower()).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid credentials.")

    if not user.is_verified:
        raise HTTPException(status_code=400, detail="Email not verified. Please sign up again.")

    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer", "email": user.email}


# =========================
# REGISTER
# =========================
@router.post("/register")
def register_user(request: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == request.email).first()
    if existing and existing.is_verified:
        raise HTTPException(status_code=400, detail="Email already registered.")
    return {"message": "Please use the OTP verification flow to register."}


# =========================
# SHARED ANALYSIS LOGIC
# =========================
def _run_analysis(resume_text: str, target_role: str, user_id: int, db: Session) -> AnalyzeResponse:
    parsed_data = parser.parse(resume_text)
    scoring_report = scorer.score(parsed_data, target_role)

    skills_found = parsed_data.get("skills", [])
    sections = parsed_data.get("raw_section_text", {})
    validated = {"experience", "projects"}

    unvalidated = []
    for skill in skills_found:
        skill_lower = skill.lower()
        found = any(skill_lower in sections.get(sec, "").lower() for sec in validated)
        if not found:
            unvalidated.append(skill)

    parsed_data["unvalidated_skills"] = unvalidated

    feedback_input = {
        **scoring_report,
        "target_role": target_role,
        "unvalidated_skills": unvalidated,
        "parsed_data": parsed_data,
    }
    feedback_data = feedback_engine.generate_feedback(feedback_input)

    analysis_record = ResumeAnalysis(
        target_role=target_role,
        overall_score=scoring_report["overall_score"],
        parsed_data=json.dumps(parsed_data),
        feedback=feedback_data["summary"],
        recommendations=json.dumps(feedback_data["recommendations"]),
        user_id=user_id,
    )
    db.add(analysis_record)
    db.commit()
    db.refresh(analysis_record)

    return AnalyzeResponse(
        status="success",
        score=scoring_report["overall_score"],
        parsed_data=parsed_data,
        feedback=feedback_data["summary"],
        recommendations=feedback_data["recommendations"],
        match_details=scoring_report.get("match_details", {}),
        score_reasoning=scoring_report.get("score_reasoning", ""),
    )


# =========================
# ANALYZE (TEXT)
# =========================
@router.post("/analyze", response_model=AnalyzeResponse)
@limiter.limit("10/minute")
def analyze_resume(
    request: Request,
    req: AnalyzeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return _run_analysis(req.resume_text, req.target_role, current_user.id, db)
    except Exception as e:
        db.rollback()
        logger.error(f"Resume analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


# =========================
# ANALYZE FILE (PDF)
# =========================
@router.post("/analyze-file", response_model=AnalyzeResponse)
@limiter.limit("10/minute")
async def analyze_resume_file(
    request: Request,
    file: UploadFile = File(...),
    target_role: str = "Software Engineer",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    try:
        contents = await file.read()
        if len(contents) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size exceeds the 10MB limit.")
        pdf = PdfReader(io.BytesIO(contents))
        resume_text = "".join(page.extract_text() or "" for page in pdf.pages)

        if not resume_text.strip():
            raise HTTPException(status_code=422, detail="Could not extract text from PDF.")

        return _run_analysis(resume_text, target_role, current_user.id, db)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"PDF analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


# =========================
# HISTORY LIST
# =========================
@router.get("/history", response_model=list[HistoryResponse])
def get_analysis_history(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    records = (
        db.query(ResumeAnalysis)
        .filter(ResumeAnalysis.user_id == current_user.id)
        .order_by(ResumeAnalysis.created_at.desc())
        .offset(skip).limit(limit).all()
    )
    return [{"id": r.id, "target_role": r.target_role, "overall_score": r.overall_score,
             "feedback": r.feedback, "created_at": r.created_at} for r in records]


# =========================
# HISTORY DETAIL
# =========================
@router.get("/history/{analysis_id}")
def get_analysis_detail(
    analysis_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = db.query(ResumeAnalysis).filter(
        ResumeAnalysis.id == analysis_id,
        ResumeAnalysis.user_id == current_user.id,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    return {"id": record.id, "target_role": record.target_role,
            "overall_score": record.overall_score, "feedback": record.feedback,
            "recommendations": record.recommendations, "parsed_data": record.parsed_data,
            "created_at": record.created_at}


# =========================
# HISTORY DELETE
# =========================
@router.delete("/history/{analysis_id}")
def delete_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = db.query(ResumeAnalysis).filter(
        ResumeAnalysis.id == analysis_id,
        ResumeAnalysis.user_id == current_user.id,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    db.delete(record)
    db.commit()
    return {"message": "Deleted successfully."}


# =========================
# ROLES
# =========================
@router.get("/roles")
def get_roles():
    return {"roles": list(scorer.ROLE_SKILL_MATRIX.keys()), "requirements": scorer.ROLE_SKILL_MATRIX}


# =========================
# CHAT
# =========================
@router.post("/chat", response_model=ChatResponse)
@limiter.limit("30/minute")
def chat_with_ai(
    request: Request,
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        reply = chat_engine.chat(
            message=req.message,
            context=req.context,
            history=[h.model_dump() for h in req.history],
        )
        return ChatResponse(reply=reply)
    except Exception as e:
        logger.error(f"Chat failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Chat failed.")

