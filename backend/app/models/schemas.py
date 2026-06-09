from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


# ── AUTH ──────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    role: str


# ── KYC ──────────────────────────────────────────────────────────────
class NICVerifyRequest(BaseModel):
    nic_number: str = Field(description="9-digit+V/X or 12-digit NIC")


class OTPVerifyRequest(BaseModel):
    otp_code: str = Field(min_length=6, max_length=6)


class KYCStatusResponse(BaseModel):
    nic_verified: bool
    otp_verified: bool
    identity_confirmed: bool
    verified_at: Optional[datetime] = None


# ── CONNECT ───────────────────────────────────────────────────────────
class ConnectStatusResponse(BaseModel):
    source: str
    connected: bool
    account_name: Optional[str] = None
    transaction_count: Optional[int] = None
    date_range_months: Optional[int] = None
    connected_at: Optional[datetime] = None


class SourcesResponse(BaseModel):
    sources: List[ConnectStatusResponse]
    confidence_contribution: float


# ── INGEST ────────────────────────────────────────────────────────────
class OCRField(BaseModel):
    field_name: str
    extracted_value: Optional[str]
    confidence: float  # 0.0–1.0
    user_verified: bool = False


class OCRResultResponse(BaseModel):
    bill_id: str
    biller_detected: str
    fields: List[OCRField]
    overall_confidence: float
    identity_match_score: float
    status: str  # clean | low_confidence | needs_review


class OCRReviewRequest(BaseModel):
    bill_id: str
    corrected_fields: dict  # {field_name: corrected_value}


# ── SCORE ─────────────────────────────────────────────────────────────
class ScoreFactorItem(BaseModel):
    feature_name: str
    display_label: str
    shap_value: float
    direction: str  # positive | negative
    reason_code: str


class ImprovementTip(BaseModel):
    heading: str
    body: str
    estimated_gain: str
    feature: str


class CategoryScore(BaseModel):
    category: str
    score: float  # 0–100
    weight: float


class ScoreResponse(BaseModel):
    score: int  # 300–850
    band: str  # poor | weak | fair | good | excellent
    confidence: float  # 0.0–1.0
    confidence_breakdown: dict
    categories: List[CategoryScore]
    top_positive_factors: List[ScoreFactorItem]
    top_negative_factors: List[ScoreFactorItem]
    improvement_tips: List[ImprovementTip]
    model_version: str
    computed_at: datetime


# ── LENDER ────────────────────────────────────────────────────────────
class LenderScoreResponse(BaseModel):
    settl_id: str
    applicant_name: str
    score: int
    band: str
    confidence: float
    top_positive_factors: List[ScoreFactorItem]
    top_negative_factors: List[ScoreFactorItem]
    meets_threshold: bool
    model_version: str
    scored_at: datetime


class LoanOutcomeRequest(BaseModel):
    user_id: str
    score_at_decision: int
    confidence_at_decision: float
    model_version: str
    decision: str  # approved | declined | conditional
    loan_amount_lkr: Optional[int] = None
    repayment_status: Optional[str] = "pending"


class LenderLoginRequest(BaseModel):
    email: EmailStr
    password: str
    institution_name: str
