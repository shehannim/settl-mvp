import numpy as np
import joblib
import shap
from pathlib import Path
from typing import Dict, List, Tuple
from datetime import datetime

MODEL_PATH = Path(__file__).parent.parent.parent / "model" / "settl_model.pkl"
EXPLAINER_PATH = Path(__file__).parent.parent.parent / "model" / "shap_explainer.pkl"
MODEL_VERSION = "v1.0-synthetic"

# Load model once at startup
_model = None
_explainer = None


def load_model():
    global _model, _explainer
    if MODEL_PATH.exists():
        _model = joblib.load(MODEL_PATH)
        if EXPLAINER_PATH.exists():
            _explainer = joblib.load(EXPLAINER_PATH)
    else:
        raise RuntimeError(f"Model not found at {MODEL_PATH}. Run scripts/train_model.py first.")


def get_model():
    global _model
    if _model is None:
        load_model()
    return _model


def get_explainer():
    global _explainer
    if _explainer is None:
        load_model()
    return _explainer


# ── FEATURE METADATA ─────────────────────────────────────────────────
FEATURE_LABELS = {
    "income_cv":                  ("Income stability",        "income"),
    "income_trend_slope":         ("Income growth trend",     "income"),
    "income_gap_months":          ("Income gap months",       "income"),
    "income_source_count":        ("Number of income sources","income"),
    "income_3m_avg":              ("3-month average income",  "income"),
    "income_6m_avg":              ("6-month average income",  "income"),
    "income_yoy_growth":          ("Year-on-year growth",     "income"),
    "bill_ontime_rate":           ("Utility bill on-time rate","payment"),
    "bill_months_coverage":       ("Bill history length",     "payment"),
    "bnpl_repayment_rate":        ("BNPL repayment rate",     "payment"),
    "avg_days_late":              ("Average days late",       "payment"),
    "payment_regularity":         ("Payment regularity",      "payment"),
    "debit_consistency":          ("Debit consistency",       "payment"),
    "payment_source_count":       ("Payment sources connected","payment"),
    "platform_level_score":       ("Platform seller level",   "platform"),
    "client_retention_rate":      ("Client retention rate",   "platform"),
    "platform_account_age_months":("Platform account age",    "platform"),
    "review_score_avg":           ("Average review score",    "platform"),
    "platform_count":             ("Platforms connected",     "platform"),
    "completed_order_rate":       ("Order completion rate",   "platform"),
    "dispute_rate":               ("Dispute rate",            "platform"),
    "total_source_count":         ("Total data sources",      "footprint"),
    "digital_tenure_months":      ("Digital history length",  "footprint"),
    "source_diversity_score":     ("Source diversity",        "footprint"),
    "business_continuity":        ("Business continuity",     "footprint"),
    "kyc_verified":               ("Identity verified",       "footprint"),
    "identity_consistency_score": ("Identity consistency",    "footprint"),
    "fraud_flag_count":           ("Fraud flags",             "footprint"),
}

FEATURE_ORDER = list(FEATURE_LABELS.keys())

REASON_CODES = {
    "bill_ontime_rate": {
        "pos": "Utility bills paid on time consistently — strong positive signal.",
        "neg": "Utility bills not consistently paid on time — this reduces your score.",
    },
    "income_cv": {
        "pos": "Very stable monthly income — reduces lending risk.",
        "neg": "High income variability — irregular earnings reduce your score.",
    },
    "income_gap_months": {
        "pos": "No income gaps in the past year — consistent earnings.",
        "neg": "Income gaps detected in the past year — this reduces your score.",
    },
    "income_source_count": {
        "pos": "Multiple income platforms connected — strong diversity signal.",
        "neg": "Only one income platform connected — add more to improve your score.",
    },
    "platform_account_age_months": {
        "pos": "Long platform account history — proven track record.",
        "neg": "Limited platform history — your score will improve over time.",
    },
    "kyc_verified": {
        "pos": "Identity verified — improves both score and confidence level.",
        "neg": "Identity not fully verified — complete KYC to improve your score.",
    },
    "fraud_flag_count": {
        "pos": "No fraud flags raised — clean profile.",
        "neg": "Fraud flags on your profile reduce your confidence score.",
    },
    "bnpl_repayment_rate": {
        "pos": "BNPL instalments paid on time.",
        "neg": "No BNPL history available — default penalty applied.",
    },
}


def probability_to_score(prob: float) -> int:
    """Maps raw model probability (0–1) to credit score (300–850)."""
    return round(300 + prob * 550)


def score_to_band(score: int) -> str:
    if score >= 750: return "excellent"
    if score >= 650: return "good"
    if score >= 550: return "fair"
    if score >= 450: return "weak"
    return "poor"


def compute_shap_values(feature_vector: np.ndarray) -> np.ndarray:
    """Returns SHAP values for the feature vector."""
    explainer = get_explainer()
    if explainer is None:
        return np.zeros(len(FEATURE_ORDER))
    values = explainer.shap_values(feature_vector)
    if isinstance(values, list):
        values = values[1]  # class 1 (creditworthy)
    return values.flatten()


def shap_to_score_points(shap_values: np.ndarray, base_prob: float = 0.5) -> np.ndarray:
    """Converts SHAP probability contributions to score point contributions."""
    return shap_values * 550


def build_factor_list(shap_points: np.ndarray, top_n: int = 3) -> Tuple[List[Dict], List[Dict]]:
    """
    Splits SHAP contributions into top positive and top negative factors.
    Returns (positive_list, negative_list) each sorted by absolute impact.
    """
    factors = []
    for i, feature in enumerate(FEATURE_ORDER):
        pts = float(shap_points[i])
        label, category = FEATURE_LABELS[feature]
        direction = "positive" if pts >= 0 else "negative"
        codes = REASON_CODES.get(feature, {})
        reason = codes.get("pos" if pts >= 0 else "neg", label)

        factors.append({
            "feature_name": feature,
            "display_label": label,
            "shap_value": round(pts, 1),
            "direction": direction,
            "reason_code": reason,
        })

    positive = sorted([f for f in factors if f["shap_value"] >= 0], key=lambda x: -x["shap_value"])[:top_n]
    negative = sorted([f for f in factors if f["shap_value"] < 0], key=lambda x: x["shap_value"])[:top_n]

    return positive, negative


def build_improvement_tips(negative_factors: List[Dict]) -> List[Dict]:
    """
    Generates actionable improvement tips from negative SHAP factors.
    Excludes non-actionable features (account age, digital tenure).
    """
    non_actionable = {"platform_account_age_months", "digital_tenure_months", "income_yoy_growth"}

    tips_map = {
        "income_source_count": {
            "heading": "Connect another income platform",
            "body": "Adding Fiverr, Upwork, or Stripe could increase your score by 20–30 points.",
            "estimated_gain": "+20–30 pts",
        },
        "bill_ontime_rate": {
            "heading": "Pay utility bills on time",
            "body": "Paying your CEB and Dialog bills before the due date for 3 consecutive months will improve this score.",
            "estimated_gain": "+15–25 pts",
        },
        "bnpl_repayment_rate": {
            "heading": "Connect your Koko account",
            "body": "Your BNPL repayment history removes the default penalty on payment behaviour.",
            "estimated_gain": "+10–15 pts",
        },
        "total_source_count": {
            "heading": "Connect more data sources",
            "body": "Each additional verified source adds to your confidence score and improves the score.",
            "estimated_gain": "+10–20 pts",
        },
        "kyc_verified": {
            "heading": "Complete identity verification",
            "body": "Completing NIC + OTP verification will unlock a higher score and confidence level.",
            "estimated_gain": "+15 pts",
        },
    }

    tips = []
    for factor in negative_factors:
        feature = factor["feature_name"]
        if feature in non_actionable:
            continue
        if feature in tips_map and len(tips) < 2:
            tips.append({**tips_map[feature], "feature": feature})

    return tips


def compute_confidence_score(
    source_count: int,
    history_months: int,
    data_completeness: float,
    soft_flag_count: int,
    identity_consistency: float,
) -> Tuple[float, Dict]:
    """
    Computes the confidence score using the formula:
    confidence = (0.40 × breadth + 0.35 × history + 0.25 × completeness)
                 × (1 - 0.15 × soft_flags) × identity_consistency
    """
    # Source breadth (max categories = 4: payment, freelance, utility, BNPL)
    max_categories = 4
    breadth = min(source_count / max_categories, 1.0)
    # Diversity bonus
    if source_count >= 3:
        breadth = min(breadth + 0.1, 1.0)

    # History length (piecewise)
    if history_months >= 24:
        history = 1.00
    elif history_months >= 18:
        history = 0.90
    elif history_months >= 12:
        history = 0.75
    elif history_months >= 6:
        history = 0.55
    elif history_months >= 3:
        history = 0.30
    else:
        history = 0.10

    # Raw confidence
    raw = (0.40 * breadth) + (0.35 * history) + (0.25 * data_completeness)

    # Fraud adjustment
    fraud_adj = max(0.0, 1.0 - 0.15 * soft_flag_count)
    final = raw * fraud_adj * identity_consistency

    return round(float(final), 2), {
        "source_breadth": round(breadth, 2),
        "history_length": round(history, 2),
        "data_completeness": round(data_completeness, 2),
        "raw_confidence": round(raw, 2),
        "fraud_adjustment": round(fraud_adj, 2),
        "identity_consistency": round(identity_consistency, 2),
    }


def compute_category_scores(shap_points: np.ndarray) -> List[Dict]:
    """
    Groups SHAP contributions by category and returns percentage scores.
    """
    categories = {"income": 0.0, "payment": 0.0, "platform": 0.0, "footprint": 0.0}
    weights =    {"income": 0.35, "payment": 0.30, "platform": 0.20, "footprint": 0.15}

    for i, feature in enumerate(FEATURE_ORDER):
        _, category = FEATURE_LABELS[feature]
        categories[category] += shap_points[i]

    # Normalise each category contribution to a 0–100 display score
    display_scores = []
    for cat, weight in weights.items():
        contribution = categories[cat]
        # Map contribution to percentage (base 50 + scaled contribution)
        pct = min(max(50 + contribution / 5, 0), 100)
        display_scores.append({
            "category": cat,
            "score": round(pct, 1),
            "weight": weight,
        })

    return display_scores


def run_scoring(feature_vector: np.ndarray) -> Dict:
    """
    Full scoring pipeline: inference → SHAP → score → explanation.
    """
    model = get_model()
    prob = float(model.predict_proba(feature_vector)[0][1])
    score = probability_to_score(prob)
    band = score_to_band(score)

    shap_values = compute_shap_values(feature_vector)
    shap_points = shap_to_score_points(shap_values)
    positive, negative = build_factor_list(shap_points)
    tips = build_improvement_tips(negative)
    categories = compute_category_scores(shap_points)

    return {
        "score": score,
        "band": band,
        "raw_probability": round(prob, 4),
        "top_positive_factors": positive,
        "top_negative_factors": negative,
        "improvement_tips": tips,
        "categories": categories,
        "model_version": MODEL_VERSION,
        "computed_at": datetime.utcnow().isoformat(),
    }
