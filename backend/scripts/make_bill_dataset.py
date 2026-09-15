"""
Generate a synthetic Sri Lankan utility-bill dataset for OCR training/eval.

Creates bill IMAGES (PNG) with varied layouts, fonts, noise and slight
rotation, plus a labels.json with ground-truth fields per image.

Usage:
    python scripts/make_bill_dataset.py --n 20 --out bill_data

Output:
    bill_data/
        ceb_0001.png, ...        # bill images
        labels.json              # [{image, biller, fields:{...}, text}]
        sft.jsonl                # instruction-tuning rows for ms-swift LoRA
                                  # (prompt='<image>document parsing.')

The PNGs double as VLM eval inputs; sft.jsonl is the LoRA training input
(see train_ocr_lora.py — needs a CUDA GPU box).
"""
import argparse
import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FIRST = ["Shehan", "Nimal", "Kamala", "Amal", "Dilani", "Ruwan", "Sanduni",
         "Kasun", "Ishara", "Tharindu", "Nadeesha", "Pradeep", "Chamari"]
LAST = ["Perera", "Fernando", "Silva", "Jayawardena", "Gunasekara", "Bandara",
        "Mendis", "Kumara", "Rathnayake", "Wickramasinghe", "De Silva"]
TITLES = ["Mr.", "Mrs.", "Ms.", "Dr."]

BILLERS = {
    "CEB": {
        "headers": ["CEYLON ELECTRICITY BOARD", "Electricity Bill - Monthly Statement"],
        "acct_fmt": lambda r: f"{r.randint(1000000000, 9999999999):010d}",
        "acct_label": "Account Number",
    },
    "LECO": {
        "headers": ["LANKA ELECTRICITY COMPANY (PVT) LTD", "LECO - Monthly Electricity Bill"],
        "acct_fmt": lambda r: f"{r.randint(1000000000, 9999999999):010d}",
        "acct_label": "Electricity Account No",
    },
    "Water Board": {
        "headers": ["NATIONAL WATER SUPPLY & DRAINAGE BOARD", "NWSDB - Monthly Water Bill"],
        "acct_fmt": lambda r: f"{r.randint(1000000000, 9999999999):010d}",
        "acct_label": "Consumer No",
    },
    "Dialog": {
        "headers": ["DIALOG AXIATA PLC", "Mobile Bill - Postpaid Statement"],
        "acct_fmt": lambda r: f"07{r.randint(10000000, 99999999):08d}",
        "acct_label": "Mobile Number",
    },
    "Dialog TV": {
        "headers": ["DIALOG TELEVISION (PVT) LTD", "Dialog TV - Monthly Statement"],
        "acct_fmt": lambda r: f"D{r.randint(10000000, 99999999):08d}",
        "acct_label": "Viewing Card No",
    },
    "Mobitel": {
        "headers": ["SRI LANKA TELECOM - MOBITEL", "SLT Mobitel - Monthly Bill",
                    "Telephone Number", "Account Number", "Invoice Number",
                    "Summary of Invoice", "Total payable", "Payment due date"],
        "acct_fmt": lambda r: f"0{r.randint(100000000, 999999999):09d}",
        "acct_label": "Account Number",
        "extra_lines": True,
    },
    "PEO TV": {
        "headers": ["SRI LANKA TELECOM - PEO TV", "PEO TV - Monthly Statement"],
        "acct_fmt": lambda r: f"0{r.randint(100000000, 999999999):09d}",
        "acct_label": "Telephone Number",
    },
    "Hutch": {
        "headers": ["HUTCHISON TELECOMMUNICATIONS LANKA", "Hutch - Monthly Bill"],
        "acct_fmt": lambda r: f"07{r.randint(80000000, 89999999):08d}",
        "acct_label": "Mobile Number",
    },
    "Airtel": {
        "headers": ["BHARTI AIRTEL LANKA (PVT) LTD", "Airtel - Monthly Statement"],
        "acct_fmt": lambda r: f"07{r.randint(50000000, 59999999):08d}",
        "acct_label": "Mobile Number",
    },
    "Lanka Bell": {
        "headers": ["LANKA BELL LIMITED", "Lanka Bell - Monthly Bill"],
        "acct_fmt": lambda r: f"0{r.randint(100000000, 999999999):09d}",
        "acct_label": "Telephone Number",
    },
}


def _font(size: int):
    for name in ("arial.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def render_bill(biller: str, fields: dict, rng: random.Random,
                w: int = 1200, h: int = 1500) -> Image.Image:
    cfg = BILLERS[biller]
    img = Image.new("RGB", (w, h), "white")
    d = ImageDraw.Draw(img)
    f_big, f_norm = _font(34), _font(26)
    y = 40
    for line in cfg["headers"][:2]:
        d.text((40, y), line, fill="black", font=f_big)
        y += 52
    y += 12
    rows = [
        (cfg["acct_label"] + ":", fields["account_number"]),
        ("Customer Name:", fields["customer_name"]),
        ("Billing Period:", fields["billing_period"]),
        ("Billing Date:", fields["billing_date"]),
        ("Total payable Rs.:", fields["amount_due"]),
        ("Payment Due Date:", fields["due_date"]),
        ("Paid on:", fields["payment_date"]),
    ]
    if cfg.get("extra_lines"):
        rows += [("Summary of Invoice", ""), ("Total payable", fields["amount_due"]),
                 ("Payment due date", fields["due_date"])]
    for label, value in rows:
        d.text((40, y), f"{label} {value}".strip(), fill="black", font=f_norm)
        y += 40
    # Light scan noise: speckles + slight rotation.
    px = img.load()
    for _ in range(rng.randint(200, 1200)):
        x, y2 = rng.randrange(w), rng.randrange(h)
        g = rng.randint(180, 235)
        px[x, y2] = (g, g, g)
    angle = rng.uniform(-0.8, 0.8)
    if abs(angle) > 0.15:
        img = img.rotate(angle, expand=True, fillcolor="white")
    return img


def sample_fields(biller: str, rng: random.Random) -> dict:
    name = f"{rng.choice(TITLES)} {rng.choice(FIRST)} {rng.choice(LAST)}"
    m = rng.randint(1, 12)
    amount = f"{rng.randint(800, 45000):,}.{rng.randint(0, 99):02d}"
    return {
        "account_number": BILLERS[biller]["acct_fmt"](rng),
        "customer_name": name,
        "billing_period": f"01/{m:02d}/2026 - {28 if m == 2 else 30}/{m:02d}/2026",
        "billing_date": f"02/{m:02d}/2026",
        "amount_due": amount,
        "due_date": f"22/{m:02d}/2026",
        "payment_date": f"04/{m:02d}/2026",
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=20)
    ap.add_argument("--out", default="bill_data")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    billers = list(BILLERS)

    labels, sft_rows = [], []
    for i in range(args.n):
        biller = billers[i % len(billers)]
        fields = sample_fields(biller, rng)
        img = render_bill(biller, fields, rng)
        fname = f"{biller.lower().replace(' ', '_')}_{i:04d}.png"
        img.save(out / fname)
        text = "\n".join([*BILLERS[biller]["headers"][:2]] + [
            f"{BILLERS[biller]['acct_label']}: {fields['account_number']}",
            f"Customer Name: {fields['customer_name']}",
            f"Billing Period: {fields['billing_period']}",
            f"Billing Date: {fields['billing_date']}",
            f"Total payable Rs. {fields['amount_due']}",
            f"Payment Due Date: {fields['due_date']}",
            f"Paid on {fields['payment_date']}",
        ])
        labels.append({"image": fname, "biller": biller, "fields": fields, "text": text})
        sft_rows.append({
            "messages": [
                {"role": "user", "content": f"<image>document parsing.\n{fname}"},
                {"role": "assistant", "content": text},
            ],
            "images": [fname],
        })

    (out / "labels.json").write_text(json.dumps(labels, indent=1), encoding="utf-8")
    with open(out / "sft.jsonl", "w", encoding="utf-8") as f:
        for row in sft_rows:
            f.write(json.dumps(row) + "\n")
    print(f"Wrote {args.n} bill images + labels.json + sft.jsonl to {out.resolve()}")


if __name__ == "__main__":
    main()
