from pydantic import BaseModel, field_validator, ConfigDict
from datetime import datetime
from typing import Any
import re


class AnalyzeRequest(BaseModel):
    resume_text: str
    target_role: str

    @field_validator("resume_text")
    @classmethod
    def resume_must_not_be_empty(cls, v):
        if not v.strip():
            raise ValueError("resume_text cannot be empty")
        return v

    @field_validator("target_role")
    @classmethod
    def role_must_not_be_empty(cls, v):
        if not v.strip():
            raise ValueError("target_role cannot be empty")
        return v


class ParsedResumeData(BaseModel):
    model_config = ConfigDict(extra="ignore", from_attributes=True)

    email: str = "Not found"
    skills: list[str] = []
    experience_years: float = 0
    education: str = "Not detected"
    word_count: int = 0
    sections: dict[str, bool] = {}
    unvalidated_skills: list[str] = []
    skill_evidence: dict[str, list[str]] = {}


class CategoryDetail(BaseModel):
    model_config = ConfigDict(extra="ignore")

    matched: list[str] = []
    missing: list[str] = []
    score: float = 0


class AnalyzeResponse(BaseModel):
    status: str
    score: float
    parsed_data: ParsedResumeData
    feedback: str
    recommendations: list[str]
    match_details: dict[str, Any] = {}
    score_reasoning: str = ""


class RegisterRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def email_must_be_valid(cls, v):
        v = v.strip().lower()
        if not re.match(r"^[\w\.-]+@[\w\.-]+\.\w{2,}$", v):
            raise ValueError("Invalid email address.")
        return v

    @field_validator("password")
    @classmethod
    def password_must_be_strong(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter.")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number.")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError("Password must contain at least one special character.")
        return v


class HistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    target_role: str
    overall_score: float
    feedback: str
    created_at: datetime


class HistoryDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    target_role: str
    overall_score: float
    parsed_data: str
    feedback: str
    recommendations: str
    created_at: datetime


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    context: dict = {}
    history: list[ChatMessage] = []

    @field_validator("message")
    @classmethod
    def message_must_not_be_empty(cls, v):
        if not v.strip():
            raise ValueError("message cannot be empty")
        return v


class ChatResponse(BaseModel):
    reply: str