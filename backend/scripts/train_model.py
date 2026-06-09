"""
Train the Settl XGBoost credit scoring model on synthetic data.
Run once: python scripts/train_model.py
The model is saved to model/settl_model.pkl
"""
import numpy as np
import pandas as pd
import joblib
import shap
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, precision_score
import xgboost as xgb

MODEL_DIR = Path(__file__).parent.parent / "model"
MODEL_DIR.mkdir(exist_ok=True)

N_SAMPLES = 2000
RANDOM_STATE = 42


def generate_synthetic_profiles(n: int) -> pd.DataFrame:
    """
    Generates realistic synthetic Sri Lankan freelancer profiles.
    Each row is one user's 28-feature vector + creditworthiness label.
    """
    rng = np.random.default_rng(RANDOM_STATE)

    # ── Income stability (7 features) ──
    income_cv           = rng.beta(2, 5, n)                      # Most stable: beta skewed low
    income_trend_slope  = rng.uniform(-0.5, 1.0, n)
    income_gap_months   = rng.choice(range(0, 13), n, p=         # Most have 0-2 gap months
                            [0.35,0.25,0.15,0.08,0.05,0.04,0.03,0.02,0.01,0.01,0.005,0.003,0.002])
    income_source_count = rng.choice([1, 2, 3, 4, 5], n, p=[0.4, 0.3, 0.15, 0.1, 0.05])
    income_3m_avg       = rng.lognormal(0.3, 0.6, n)             # Around LKR 150k median
    income_6m_avg       = income_3m_avg * rng.uniform(0.8, 1.2, n)
    income_yoy_growth   = rng.normal(0.2, 0.5, n).clip(-1, 3)

    # ── Payment behaviour (7 features) ──
    bill_ontime_rate      = rng.beta(7, 2, n)                    # Most pay on time
    bill_months_coverage  = rng.choice(range(0, 25), n)
    bnpl_repayment_rate   = rng.beta(5, 2, n)
    avg_days_late         = 1.0 - bill_ontime_rate + rng.normal(0, 0.05, n).clip(-0.1, 0.2)
    avg_days_late         = avg_days_late.clip(0, 1)
    payment_regularity    = bill_ontime_rate * rng.uniform(0.8, 1.0, n)
    debit_consistency     = rng.beta(5, 2, n)
    payment_source_count  = rng.choice([0, 1, 2, 3], n, p=[0.1, 0.5, 0.3, 0.1])

    # ── Platform reputation (7 features) ──
    platform_level_score       = rng.beta(3, 3, n)
    client_retention_rate      = rng.beta(3, 4, n)
    platform_account_age_months= rng.choice(range(1, 121), n)
    review_score_avg           = rng.beta(6, 2, n)
    platform_count             = rng.choice([1, 2, 3, 4, 5, 6], n, p=[0.4, 0.3, 0.15, 0.08, 0.04, 0.03])
    completed_order_rate       = rng.beta(7, 2, n)
    dispute_rate               = rng.beta(1, 10, n)

    # ── Digital footprint (7 features) ──
    total_source_count         = rng.choice(range(1, 11), n)
    digital_tenure_months      = rng.choice(range(1, 121), n)
    source_diversity_score     = (total_source_count / 10).clip(0, 1)
    business_continuity        = rng.beta(5, 2, n)
    kyc_verified               = rng.choice([0, 1], n, p=[0.1, 0.9])
    identity_consistency_score = rng.beta(8, 2, n)
    fraud_flag_count           = rng.choice([0, 1, 2, 3], n, p=[0.75, 0.15, 0.07, 0.03])

    df = pd.DataFrame({
        "income_cv": income_cv,
        "income_trend_slope": income_trend_slope,
        "income_gap_months": income_gap_months,
        "income_source_count": income_source_count,
        "income_3m_avg": income_3m_avg,
        "income_6m_avg": income_6m_avg,
        "income_yoy_growth": income_yoy_growth,
        "bill_ontime_rate": bill_ontime_rate,
        "bill_months_coverage": bill_months_coverage,
        "bnpl_repayment_rate": bnpl_repayment_rate,
        "avg_days_late": avg_days_late,
        "payment_regularity": payment_regularity,
        "debit_consistency": debit_consistency,
        "payment_source_count": payment_source_count,
        "platform_level_score": platform_level_score,
        "client_retention_rate": client_retention_rate,
        "platform_account_age_months": platform_account_age_months,
        "review_score_avg": review_score_avg,
        "platform_count": platform_count,
        "completed_order_rate": completed_order_rate,
        "dispute_rate": dispute_rate,
        "total_source_count": total_source_count,
        "digital_tenure_months": digital_tenure_months,
        "source_diversity_score": source_diversity_score,
        "business_continuity": business_continuity,
        "kyc_verified": kyc_verified,
        "identity_consistency_score": identity_consistency_score,
        "fraud_flag_count": fraud_flag_count,
    })

    return df


def generate_labels(df: pd.DataFrame) -> np.ndarray:
    """
    Rule-based oracle assigns creditworthiness labels.
    Positive (creditworthy=1) requires:
      - income_cv < 0.4 (stable)
      - bill_ontime_rate > 0.75
      - income_source_count >= 2
      - fraud_flag_count == 0
      - kyc_verified == 1
    Hard negative: gap_months > 5 or fraud_flag_count > 1
    Others get probabilistic labels.
    """
    labels = np.zeros(len(df), dtype=int)
    rng = np.random.default_rng(RANDOM_STATE + 1)

    for i, row in df.iterrows():
        # Hard positive
        if (row.income_cv < 0.35
                and row.bill_ontime_rate > 0.8
                and row.income_source_count >= 2
                and row.fraud_flag_count == 0
                and row.kyc_verified == 1
                and row.income_gap_months <= 1):
            labels[i] = 1

        # Hard negative
        elif row.income_gap_months > 5 or row.fraud_flag_count > 1:
            labels[i] = 0

        # Probabilistic middle ground
        else:
            score = (
                (1 - row.income_cv) * 0.30
                + row.bill_ontime_rate * 0.25
                + min(row.income_source_count / 3, 1) * 0.15
                + row.kyc_verified * 0.10
                + row.identity_consistency_score * 0.10
                + (1 - row.income_gap_months / 12) * 0.10
            )
            labels[i] = 1 if rng.random() < score else 0

    return labels


def train():
    print("Generating synthetic profiles...")
    df = generate_synthetic_profiles(N_SAMPLES)
    labels = generate_labels(df)

    print(f"Label distribution: {labels.sum()} positive, {(1-labels).sum()} negative out of {N_SAMPLES}")

    X_train, X_test, y_train, y_test = train_test_split(
        df.values, labels, test_size=0.2, random_state=RANDOM_STATE, stratify=labels
    )

    print("Training XGBoost model...")
    model = xgb.XGBClassifier(
        n_estimators=200,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        use_label_encoder=False,
        eval_metric="logloss",
        random_state=RANDOM_STATE,
        enable_categorical=False,
    )
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    # Validate
    y_prob = model.predict_proba(X_test)[:, 1]
    auc = roc_auc_score(y_test, y_prob)
    y_pred = (y_prob >= 0.5).astype(int)
    precision = precision_score(y_test, y_pred, zero_division=0)

    print(f"Validation AUC: {auc:.4f}  (target ≥ 0.78)")
    print(f"Precision at 0.5: {precision:.4f}  (target ≥ 0.72)")

    if auc < 0.78:
        print("⚠ AUC below threshold — model saved anyway for demo use.")

    # Save model
    model_path = MODEL_DIR / "settl_model.pkl"
    joblib.dump(model, model_path)
    print(f"Model saved to {model_path}")

    # Build and save SHAP explainer
    print("Building SHAP explainer...")
    explainer = shap.TreeExplainer(model)
    explainer_path = MODEL_DIR / "shap_explainer.pkl"
    joblib.dump(explainer, explainer_path)
    print(f"SHAP explainer saved to {explainer_path}")

    # Save feature names for reference
    feature_names_path = MODEL_DIR / "feature_names.txt"
    feature_names_path.write_text("\n".join(df.columns.tolist()))
    print(f"Feature names saved to {feature_names_path}")

    print("\nTraining complete.")
    return auc, precision


if __name__ == "__main__":
    auc, precision = train()
    print(f"\nFinal: AUC={auc:.4f}, Precision={precision:.4f}")
