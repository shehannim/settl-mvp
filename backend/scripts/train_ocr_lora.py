"""
LoRA fine-tune Baidu Unlimited-OCR on Sri Lankan bills (GPU-only).

Requires a CUDA GPU with ~24GB VRAM (single 4090/A10G class box).
Training is supported upstream via ms-swift (see model card):
    https://huggingface.co/baidu/Unlimited-OCR

Steps:
    1. python scripts/make_bill_dataset.py --n 200 --out bill_data
       (add REAL scanned bill photos to bill_data/ + rows in labels.json
        for best results — synthetic data alone only teaches layout)
    2. On the GPU box: pip install ms-swift
    3. python scripts/train_ocr_lora.py --data bill_data --epochs 3

This script only BUILDS and PRINTS the swift command (plus sanity checks)
so training stays reproducible and auditable.
"""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="bill_data")
    ap.add_argument("--epochs", type=int, default=3)
    ap.add_argument("--run", action="store_true",
                    help="actually launch training (default: dry-run print)")
    args = ap.parse_args()

    data = Path(args.data)
    sft = data / "sft.jsonl"
    if not sft.exists():
        raise SystemExit(f"Missing {sft} — run make_bill_dataset.py first.")
    n = sum(1 for _ in open(sft, encoding="utf-8"))
    print(f"SFT rows: {n}")

    try:
        import torch
        cuda = torch.cuda.is_available()
        vram = (torch.cuda.get_device_properties(0).total_memory / 1e9
                if cuda else 0)
        print(f"CUDA: {cuda} VRAM: {vram:.1f}GB")
    except ImportError:
        cuda, vram = False, 0
        print("torch not installed here — command targets a GPU box.")

    if not shutil.which("swift"):
        print("ms-swift not installed. On the GPU box: pip install ms-swift")
        if args.run:
            raise SystemExit("Install ms-swift first.")

    cmd = [
        "swift", "sft",
        "--model", "baidu/Unlimited-OCR",
        "--dataset", str(sft.resolve()),
        "--lora_rank", "8",
        "--lora_alpha", "32",
        "--lora_dropout", "0.05",
        "--num_train_epochs", str(args.epochs),
        "--per_device_train_batch_size", "1",
        "--gradient_accumulation_steps", "8",
        "--learning_rate", "1e-4",
        "--bf16", "true",
        "--gradient_checkpointing", "true",
        "--output_dir", "runs/unlimited-ocr-sl-bills",
        "--save_steps", "100",
    ]
    print("CMD: " + " ".join(cmd))
    if n < 50:
        print("WARNING: <50 rows — add real bill photos before real training.")
    if vram and vram < 20:
        print("WARNING: <20GB VRAM — expect OOM; use --lora_rank 4 or a bigger GPU.")
    if args.run:
        if not cuda:
            raise SystemExit("Refusing to train without CUDA (would take weeks on CPU).")
        sys.exit(subprocess.call(cmd))


if __name__ == "__main__":
    main()
