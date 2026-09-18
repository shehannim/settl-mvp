"""Local retraining on REAL lender-reported outcomes (CPU-only, no GPU/cloud).

Pipeline:
  Supabase loan_outcomes (labels) + scores.feature_vector (features)
      → labelled dataset (JSONL cacheable for offline/air-gapped runs)
      → stratified train/val/test split
      → challenger XGBoost vs champion (current model/settl_model.ubj)
      → promote only on: challenger AUC > champion AUC AND floors met
      → versioned artifacts in model/registry/

Docs alignment: min 500 labelled outcomes before prod (012); retrain floors
AUC>=0.78; runs on a laptop in minutes for tens of thousands of rows.

Usage:
  # 1. Export what the DB has (no training):
  python scripts/retrain_local.py --export-only

  # 2. Train from live DB (needs SUPABASE_URL + SUPABASE_SERVICE_KEY):
  python scripts/retrain_local.py

  # 3. Train fully offline from a prior export:
  python scripts/retrain_local.py --from-jsonl model/registry/dataset-YYYYMMDD.jsonl

  # 4. Demo with few labels (NOT for prod — docs require 500):
  python scripts/retrain_local.py --from-jsonl <file> --min-labels 10
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

BACKEND_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND_DIR))

MODEL_DIR = BACKEND_DIR / "model"
REGISTRY_DIR = MODEL_DIR / "registry"
CHAMPION_UBJ = MODEL_DIR / "settl_model.ubj"
CHAMPION_PKL = MODEL_DIR / "settl_model.pkl"

# Must stay identical to scripts/train_model.py + scoring_service.MODEL_PARAMS.
TRAIN_PARAMS = {
    "n_estimators": 200,
    "max_depth": 5,
    "learning_rate": 0.05,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "eval_metric": "logloss",
    "random_state": 42,
    "enable_categorical": False,
}

# Docs floors (012): promote only above these AND above the champion.
MIN_AUC = 0.78
MIN_PRECISION = 0.70
DEFAULT_MIN_LABELS = 500  # docs 012: minimum real-data threshold before prod

# repayment_status -> label. 'pending' has no outcome yet and is excluded.
LABEL_MAP = {
    "on_time": 1,
    "repaid": 1,
    "late": 0,
    "late_<30": 0,
    "late_30": 0,
    "defaulted": 0,
}


def fetch_labelled_from_db() -> pd.DataFrame:
    """Pulls (feature_vector, label) pairs from Supabase."""
    from supabase import create_client

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY env vars required for live pull.")

    db = create_client(url, key)
    outcomes = (
        db.table("loan_outcomes")
        .select("user_id, repayment_status")
        .neq("repayment_status", "pending")
        .execute()
        .data
        or []
    )
    rows = []
    for oc in outcomes:
        status = (oc.get("repayment_status") or "").lower()
        if status not in LABEL_MAP:
            continue
        # Latest score's feature vector for this user.
        scores = (
            db.table("scores")
            .select("feature_vector")
            .eq("user_id", oc["user_id"])
            .order("computed_at", desc=True)
            .limit(1)
            .execute()
            .data
            or []
        )
        if not scores or not scores[0].get("feature_vector"):
            continue
        vec = scores[0]["feature_vector"]
        if isinstance(vec, str):
            vec = json.loads(vec)
        rows.append({"features": list(vec), "label": LABEL_MAP[status]})
    df = pd.DataFrame(rows)
    print(f"Live pull: {len(df)} labelled rows "
          f"({int(df['label'].sum()) if len(df) else 0} positive).")
    return df


def load_jsonl(path: Path) -> pd.DataFrame:
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    df = pd.DataFrame(rows)
    print(f"Loaded {len(df)} rows from {path}.")
    return df


def evaluate(model, X_test, y_test) -> dict:
    from sklearn.metrics import roc_auc_score, precision_score, recall_score

    prob = model.predict_proba(np.asarray(X_test, dtype=np.float32))[:, 1]
    pred = (prob >= 0.5).astype(int)
    return {
        "auc": round(float(roc_auc_score(y_test, prob)), 4),
        "precision": round(float(precision_score(y_test, pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, pred, zero_division=0)), 4),
        "n_test": int(len(y_test)),
    }


def load_champion():
    """Loads the current production model (native .ubj preferred, .pkl fallback)."""
    import xgboost as xgb

    if CHAMPION_UBJ.exists():
        model = xgb.XGBClassifier(**TRAIN_PARAMS)
        model.load_model(CHAMPION_UBJ)
        return model, "ubj"
    if CHAMPION_PKL.exists():
        return joblib.load(CHAMPION_PKL), "pkl"
    return None, "none"


def main() -> int:
    parser = argparse.ArgumentParser(description="Local retraining on real outcomes.")
    parser.add_argument("--from-jsonl", type=Path, default=None)
    parser.add_argument("--export-only", action="store_true")
    parser.add_argument("--min-labels", type=int, default=DEFAULT_MIN_LABELS)
    parser.add_argument("--no-promote", action="store_true",
                        help="Evaluate challenger without touching production artifacts.")
    args = parser.parse_args()

    REGISTRY_DIR.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")

    df = load_jsonl(args.from_jsonl) if args.from_jsonl else fetch_labelled_from_db()
    if len(df) == 0:
        print("No labelled rows available. Nothing to do.")
        return 3

    export_path = REGISTRY_DIR / f"dataset-{stamp}.jsonl"
    with open(export_path, "w", encoding="utf-8") as f:
        for _, r in df.iterrows():
            f.write(json.dumps({"features": list(r["features"]), "label": int(r["label"])}) + "\n")
    print(f"Dataset cached at {export_path} (re-runnable offline).")
    if args.export_only:
        return 0

    if len(df) < args.min_labels:
        print(f"Only {len(df)} labels < minimum {args.min_labels} — refusing to train "
              f"(docs 012 require {DEFAULT_MIN_LABELS} for prod).")
        return 4
    if len(df) < DEFAULT_MIN_LABELS:
        print(f"WARNING: training below the {DEFAULT_MIN_LABELS}-label prod gate — demo only.")

    from sklearn.model_selection import train_test_split
    import xgboost as xgb

    X = np.asarray(df["features"].tolist(), dtype=np.float32)
    y = np.asarray(df["label"].tolist(), dtype=int)
    if len(np.unique(y)) < 2:
        print("Single-class dataset — cannot train a classifier.")
        return 5

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"Split: {len(X_train)} train / {len(X_test)} test.")

    challenger = xgb.XGBClassifier(**TRAIN_PARAMS)
    challenger.fit(X_train, y_train, verbose=False)
    chal_metrics = evaluate(challenger, X_test, y_test)
    print(f"Challenger: {chal_metrics}")

    champion, kind = load_champion()
    champ_metrics = evaluate(champion, X_test, y_test) if champion is not None else None
    print(f"Champion ({kind}): {champ_metrics}")

    beats = champ_metrics is None or chal_metrics["auc"] > champ_metrics["auc"]
    floors = chal_metrics["auc"] >= MIN_AUC and chal_metrics["precision"] >= MIN_PRECISION

    metrics = {
        "trained_at": stamp,
        "n_labels": len(df),
        "challenger": chal_metrics,
        "champion": champ_metrics,
        "promoted": False,
    }

    if beats and floors and not args.no_promote:
        version = f"v{stamp}-local"
        dest = REGISTRY_DIR / version
        dest.mkdir(exist_ok=True)
        challenger.save_model(dest / "settl_model.ubj")
        joblib.dump(challenger, dest / "settl_model.pkl")
        (dest / "metrics.json").write_text(json.dumps(metrics | {"promoted": True}, indent=1))
        challenger.save_model(CHAMPION_UBJ)  # promote: challenger becomes production
        metrics["promoted"] = True
        metrics["version"] = version
        print(f"PROMOTED {version} -> {CHAMPION_UBJ}")
        print("Next: set scoring_service MODEL_VERSION to "
              f"{version!r} and redeploy, then monitor AUC/precision.")
    else:
        reason = []
        if not beats:
            reason.append("does not beat champion")
        if not floors:
            reason.append(f"below floors (AUC>={MIN_AUC}, P>={MIN_PRECISION})")
        if args.no_promote:
            reason.append("--no-promote")
        print("NOT promoted (" + "; ".join(reason) + "). Production model untouched.")

    (REGISTRY_DIR / f"metrics-{stamp}.json").write_text(json.dumps(metrics, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
