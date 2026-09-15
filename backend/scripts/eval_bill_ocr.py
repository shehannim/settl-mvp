"""
Evaluate the bill OCR pipeline against the synthetic dataset.

Fast mode (default): feeds each sample's plain text through the regex
field-extraction layer (detect_biller + extract_fields) and scores
biller accuracy + per-field recall. No GPU/VLM needed.

End-to-end mode (--vlm N): embeds N sample PNGs into PDFs and runs the full
process_bill() pipeline (pdfminer -> Baidu VLM -> regex). Slow on CPU
(~1 min/page for the VLM) — use N=1-3 for smoke tests.

Usage:
    python scripts/make_bill_dataset.py --n 30 --out bill_data
    python scripts/eval_bill_ocr.py --data bill_data
    python scripts/eval_bill_ocr.py --data bill_data --vlm 2
"""
import argparse
import io
import json
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

FIELDS = ["account_number", "customer_name", "billing_period",
          "amount_due", "due_date"]


def norm(s) -> str:
    return " ".join(str(s or "").lower().replace(",", "").split())


def score_regex_layer(data_dir: Path) -> dict:
    from app.services.ocr_service import detect_biller, extract_fields, clean_text

    labels = json.loads((data_dir / "labels.json").read_text(encoding="utf-8"))
    biller_ok, field_hit, field_tot = 0, 0, 0
    for row in labels:
        text = clean_text(row["text"])
        pred_biller = detect_biller(text) or "Unknown"
        biller_ok += pred_biller == row["biller"]
        fields = {f["field_name"]: (f.get("extracted_value") or "")
                  for f in extract_fields(text, pred_biller)}
        for name in FIELDS:
            want = norm(row["fields"].get(name, ""))
            got = norm(fields.get(name, ""))
            field_tot += 1
            if want and (want == got or want in got or got in want):
                field_hit += 1
    return {
        "samples": len(labels),
        "biller_accuracy": round(biller_ok / max(len(labels), 1), 3),
        "field_recall": round(field_hit / max(field_tot, 1), 3),
    }


def score_vlm_end_to_end(data_dir: Path, n: int) -> dict:
    from PIL import Image
    from app.services.ocr_service import process_bill

    labels = json.loads((data_dir / "labels.json").read_text(encoding="utf-8"))[:n]
    biller_ok = 0
    for row in labels:
        img = Image.open(data_dir / row["image"]).convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="PDF")
        try:
            res = process_bill(buf.getvalue())
        except Exception as e:
            print(f"  {row['image']}: pipeline error {e}")
            continue
        pred = res.get("biller_detected", "Unknown")
        hit = pred == row["biller"]
        biller_ok += hit
        print(f"  {row['image']}: biller={pred} "
              f"({'OK' if hit else 'want ' + row['biller']}) "
              f"conf={res.get('overall_confidence', 0):.2f}")
    return {"vlm_samples": len(labels),
            "vlm_biller_accuracy": round(biller_ok / max(len(labels), 1), 3)}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="bill_data")
    ap.add_argument("--vlm", type=int, default=0,
                    help="end-to-end VLM samples (slow on CPU)")
    args = ap.parse_args()

    data_dir = Path(args.data)
    if not (data_dir / "labels.json").exists():
        raise SystemExit(f"No labels.json in {data_dir} — run make_bill_dataset.py first.")

    print("== regex layer ==")
    print(json.dumps(score_regex_layer(data_dir), indent=1))
    if args.vlm > 0:
        print(f"== end-to-end VLM (n={args.vlm}) ==")
        print(json.dumps(score_vlm_end_to_end(data_dir, args.vlm), indent=1))


if __name__ == "__main__":
    main()
