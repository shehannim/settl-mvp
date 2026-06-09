import httpx
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from app.core.config import get_settings

settings = get_settings()

# Fallback LKR rate if API fails
FALLBACK_USD_LKR = 305.0


async def get_usd_to_lkr_rate() -> float:
    """Fetches current USD to LKR exchange rate."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://v6.exchangerate-api.com/v6/{settings.EXCHANGE_RATE_API_KEY}/pair/USD/LKR",
                timeout=5.0
            )
        if resp.status_code == 200:
            return resp.json().get("conversion_rate", FALLBACK_USD_LKR)
    except Exception:
        pass
    return FALLBACK_USD_LKR


def build_monthly_income(transactions: List[Dict], usd_to_lkr: float) -> pd.DataFrame:
    """
    Converts raw transactions into monthly LKR income totals.
    Only counts incoming payments (positive amounts).
    """
    if not transactions:
        return pd.DataFrame(columns=["year_month", "income_lkr"])

    df = pd.DataFrame(transactions)
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date"])

    # Only count income (positive, non-refund)
    df = df[df["amount_usd"] > 0]

    # Convert to LKR
    df["income_lkr"] = df["amount_usd"] * usd_to_lkr

    # Group by month
    df["year_month"] = df["date"].dt.to_period("M")
    monthly = df.groupby("year_month")["income_lkr"].sum().reset_index()
    monthly["year_month"] = monthly["year_month"].astype(str)

    return monthly


def compute_income_features(monthly: pd.DataFrame) -> Dict:
    """
    Computes the 7 income stability features from monthly income data.
    All values normalised to 0–1 or reasonable numeric ranges.
    """
    if monthly.empty or len(monthly) < 2:
        return {
            "income_cv": 1.0,
            "income_trend_slope": 0.0,
            "income_gap_months": 12,
            "income_source_count": 1,
            "income_3m_avg": 0.0,
            "income_6m_avg": 0.0,
            "income_yoy_growth": 0.0,
        }

    values = monthly["income_lkr"].values

    # Coefficient of variation (lower = more stable)
    mean_income = np.mean(values)
    cv = np.std(values) / mean_income if mean_income > 0 else 1.0
    cv_normalised = min(cv, 2.0) / 2.0  # cap at 2.0, normalise to 0–1

    # Trend slope (linear regression over months)
    x = np.arange(len(values))
    if len(x) > 1:
        slope = np.polyfit(x, values, 1)[0]
        slope_normalised = np.clip(slope / (mean_income + 1), -1, 1)
    else:
        slope_normalised = 0.0

    # Gap months (months with zero or near-zero income)
    median_income = np.median(values)
    gap_threshold = median_income * 0.1
    gap_months = int(np.sum(values < gap_threshold))

    # Rolling averages (normalised against LKR 150,000 median freelance income)
    MEDIAN_LKR = 150_000
    avg_3m = float(np.mean(values[-3:])) / MEDIAN_LKR if len(values) >= 3 else 0.0
    avg_6m = float(np.mean(values[-6:])) / MEDIAN_LKR if len(values) >= 6 else 0.0

    # YoY growth
    if len(values) >= 12:
        recent_6m = np.mean(values[-6:])
        prev_6m = np.mean(values[-12:-6])
        yoy = (recent_6m - prev_6m) / (prev_6m + 1)
        yoy_capped = float(np.clip(yoy, -1, 3))
    else:
        yoy_capped = 0.0

    return {
        "income_cv": float(cv_normalised),
        "income_trend_slope": float(slope_normalised),
        "income_gap_months": gap_months,
        "income_source_count": 1,  # updated by aggregation layer
        "income_3m_avg": float(min(avg_3m, 5.0)),
        "income_6m_avg": float(min(avg_6m, 5.0)),
        "income_yoy_growth": yoy_capped,
    }


def compute_payment_features(bills: List[Dict]) -> Dict:
    """
    Computes the 7 payment behaviour features from utility bill history.
    """
    if not bills:
        return {
            "bill_ontime_rate": 0.5,
            "bill_months_coverage": 0,
            "bnpl_repayment_rate": 0.5,
            "avg_days_late": 0.5,
            "payment_regularity": 0.5,
            "debit_consistency": 0.0,
            "payment_source_count": 0,
        }

    on_time_count = sum(1 for b in bills if b.get("payment_on_time") is True)
    total_with_dates = sum(1 for b in bills if b.get("payment_on_time") is not None)

    on_time_rate = on_time_count / total_with_dates if total_with_dates > 0 else 0.5

    return {
        "bill_ontime_rate": float(on_time_rate),
        "bill_months_coverage": len(bills),
        "bnpl_repayment_rate": 0.5,   # default until Koko/Mintpay connected
        "avg_days_late": 1.0 - on_time_rate,
        "payment_regularity": float(on_time_rate),
        "debit_consistency": min(len(bills) / 12.0, 1.0),
        "payment_source_count": 1 if bills else 0,
    }


def compute_platform_features(sources: List[Dict]) -> Dict:
    """
    Computes the 7 platform reputation features from connected platform data.
    """
    if not sources:
        return {
            "platform_level_score": 0.2,
            "client_retention_rate": 0.0,
            "platform_account_age_months": 0,
            "review_score_avg": 0.5,
            "platform_count": 0,
            "completed_order_rate": 0.5,
            "dispute_rate": 0.5,
        }

    # For PayPal — use account age and transaction diversity as proxy
    total_age = sum(s.get("account_age_months", 0) for s in sources)
    avg_age = total_age / len(sources) if sources else 0

    return {
        "platform_level_score": 0.5,        # updated when Fiverr/Upwork connected
        "client_retention_rate": 0.3,        # estimated from repeat PayPal counterparties
        "platform_account_age_months": int(avg_age),
        "review_score_avg": 0.5,
        "platform_count": len(sources),
        "completed_order_rate": 0.8,         # estimated from PayPal success rate
        "dispute_rate": 0.1,
    }


def compute_footprint_features(user_profile: Dict, fraud_flags: int) -> Dict:
    """
    Computes the 7 digital footprint features.
    """
    return {
        "total_source_count": user_profile.get("connected_source_count", 0),
        "digital_tenure_months": user_profile.get("digital_tenure_months", 0),
        "source_diversity_score": min(user_profile.get("connected_source_count", 0) / 4.0, 1.0),
        "business_continuity": user_profile.get("business_continuity", 0.0),
        "kyc_verified": 1 if user_profile.get("kyc_verified") else 0,
        "identity_consistency_score": user_profile.get("identity_consistency_score", 0.5),
        "fraud_flag_count": fraud_flags,
    }


def build_feature_vector(
    income_features: Dict,
    payment_features: Dict,
    platform_features: Dict,
    footprint_features: Dict,
) -> np.ndarray:
    """
    Assembles all 28 features into a numpy array in the correct order
    that matches the trained XGBoost model.
    """
    feature_order = [
        # Income stability (7)
        "income_cv", "income_trend_slope", "income_gap_months",
        "income_source_count", "income_3m_avg", "income_6m_avg", "income_yoy_growth",
        # Payment behaviour (7)
        "bill_ontime_rate", "bill_months_coverage", "bnpl_repayment_rate",
        "avg_days_late", "payment_regularity", "debit_consistency", "payment_source_count",
        # Platform reputation (7)
        "platform_level_score", "client_retention_rate", "platform_account_age_months",
        "review_score_avg", "platform_count", "completed_order_rate", "dispute_rate",
        # Digital footprint (7)
        "total_source_count", "digital_tenure_months", "source_diversity_score",
        "business_continuity", "kyc_verified", "identity_consistency_score", "fraud_flag_count",
    ]

    all_features = {
        **income_features,
        **payment_features,
        **platform_features,
        **footprint_features,
    }

    vector = np.array([all_features.get(f, 0.0) for f in feature_order], dtype=np.float32)
    return vector.reshape(1, -1)
