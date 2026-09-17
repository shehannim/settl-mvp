import re
import io
from typing import Dict, List, Optional

try:
    import pytesseract
    from PIL import Image
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False

try:
    from pdfminer.high_level import extract_text as pdfminer_extract
    from pdfminer.layout import LAParams
    PDFMINER_AVAILABLE = True
except ImportError:
    PDFMINER_AVAILABLE = False


# ── BILLER PATTERNS ──────────────────────────────────────────────────

BILLER_PATTERNS = {
    "LECO": {
        # NOTE: must stay before CEB — CEB's generic "electricity bill"
        # pattern would otherwise swallow LECO bills.
        "detect": [
            r"lanka\s+electricity\s+company",
            r"\bleco\b",
        ],
        "fields": {
            "customer_name": [
                r"(?:name|customer\s*name|consumer\s*name)\s*[:\-]?\s*([A-Z][A-Za-z\s\.]{3,80})",
            ],
            "account_number": [
                r"(?:account\s*(?:no|number|#)|consumer\s*(?:no|number)|electricity\s*account)\s*[:\-]?\s*([A-Z0-9\-\/\s]{6,25})",
                r"\b(\d{10})\b",
            ],
            "billing_period": [
                r"(?:billing\s*period|bill\s*period|period)\s*[:\-]?\s*([A-Za-z0-9\s\/\-\–\.]{5,80})",
            ],
            "amount_due": [
                r"(?:amount\s*due|total\s*due|total\s*amount|balance\s*payable|amount\s*payable|net\s*amount)\s*[:\-]?\s*(?:rs\.?|lkr)?\s*([\d,]+(?:\.\d{1,2})?)",
                r"(?:rs\.?|lkr)\s*([\d,]+(?:\.\d{1,2})?)",
            ],
            "due_date": [
                r"(?:due\s*date|payment\s*due\s*date|pay\s*before|payable\s*before|due\s*by)\s*[:\-]?\s*([0-9]{1,2}[\/\-\.\s][A-Za-z0-9]{1,9}[\/\-\.\s][0-9]{2,4})",
            ],
            "payment_date": [
                r"(?:paid\s*on|payment\s*date|date\s*of\s*payment|last\s*payment)\s*[:\-]?\s*([0-9]{1,2}[\/\-\.\s][A-Za-z0-9]{1,9}[\/\-\.\s][0-9]{2,4})",
            ],
        },
    },

    "CEB": {
        "detect": [
            r"ceylon\s+electricity\s+board",
            r"\bceb\b",
            r"electricity\s+bill",
        ],
        "fields": {
            "customer_name": [
                r"(?:name|customer\s*name|consumer\s*name)\s*[:\-]?\s*([A-Z][A-Za-z\s\.]{3,80})",
            ],
            "account_number": [
                r"(?:account\s*(?:no|number|#)|consumer\s*(?:no|number))\s*[:\-]?\s*([A-Z0-9\-\/\s]{6,25})",
            ],
            "billing_period": [
                r"(?:billing\s*period|bill\s*period|period)\s*[:\-]?\s*([A-Za-z0-9\s\/\-\–\.]{5,80})",
            ],
            "amount_due": [
                r"(?:amount\s*due|total\s*due|total\s*amount|balance\s*payable|amount\s*payable)\s*[:\-]?\s*(?:rs\.?|lkr)?\s*([\d,]+(?:\.\d{1,2})?)",
                r"(?:rs\.?|lkr)\s*([\d,]+(?:\.\d{1,2})?)",
            ],
            "due_date": [
                r"(?:due\s*date|payment\s*due\s*date|pay\s*before|payable\s*before)\s*[:\-]?\s*([0-9]{1,2}[\/\-\.\s][A-Za-z0-9]{1,9}[\/\-\.\s][0-9]{2,4})",
            ],
            "payment_date": [
                r"(?:paid\s*on|payment\s*date|date\s*of\s*payment)\s*[:\-]?\s*([0-9]{1,2}[\/\-\.\s][A-Za-z0-9]{1,9}[\/\-\.\s][0-9]{2,4})",
            ],
        },
    },

    "Dialog TV": {
        # NOTE: must stay before Dialog — Dialog's bare "dialog" pattern
        # would otherwise swallow Dialog TV bills.
        "detect": [
            r"dialog\s*tv",
            r"dialog\s*television",
        ],
        "fields": {
            "customer_name": [
                r"(?:name|customer\s*name|subscriber\s*name)\s*[:\-]?\s*([A-Z][A-Za-z\s\.]{3,80})",
            ],
            "account_number": [
                r"(?:account\s*(?:no|number|#)|subscriber\s*(?:no|number)|smart\s*card\s*(?:no|number)|viewing\s*card)\s*[:\-]?\s*([A-Z0-9\-\/\s]{6,25})",
            ],
            "billing_period": [
                r"(?:billing\s*period|bill\s*period|period|subscription\s*period)\s*[:\-]?\s*([A-Za-z0-9\s\/\-\–\.]{5,80})",
            ],
            "amount_due": [
                r"(?:amount\s*due|total\s*payable|amount\s*payable|total\s*amount|balance\s*due|monthly\s*rental)\s*[:\-]?\s*(?:rs\.?|lkr)?\s*([\d,]+(?:\.\d{1,2})?)",
                r"(?:rs\.?|lkr)\s*([\d,]+(?:\.\d{1,2})?)",
            ],
            "due_date": [
                r"(?:due\s*date|payment\s*due|pay\s*before|expiry\s*date)\s*[:\-]?\s*([0-9]{1,2}[\/\-\.\s][A-Za-z0-9]{1,9}[\/\-\.\s][0-9]{2,4})",
            ],
            "payment_date": [
                r"(?:paid|payment\s*received|payment\s*date|recharged\s*on)\s*[:\-]?\s*([0-9]{1,2}[\/\-\.\s][A-Za-z0-9]{1,9}[\/\-\.\s][0-9]{2,4})",
            ],
        },
    },

    "Dialog": {
        "detect": [
            r"dialog\s*axiata",
            r"dialog\s*broadband",
            r"dialog\s*telecom",
            r"\bdialog\b",
        ],
        "fields": {
            "customer_name": [
                r"(?:name|customer\s*name|subscriber\s*name)\s*[:\-]?\s*([A-Z][A-Za-z\s\.]{3,80})",
            ],
            "account_number": [
                r"(?:account\s*(?:no|number|#)|subscriber\s*(?:no|number)|mobile\s*(?:no|number))\s*[:\-]?\s*([A-Z0-9\-\/\s]{6,25})",
            ],
            "billing_period": [
                r"(?:billing\s*period|bill\s*period|period)\s*[:\-]?\s*([A-Za-z0-9\s\/\-\–\.]{5,80})",
            ],
            "amount_due": [
                r"(?:amount\s*due|total\s*payable|amount\s*payable|total\s*amount|balance\s*due)\s*[:\-]?\s*(?:rs\.?|lkr)?\s*([\d,]+(?:\.\d{1,2})?)",
                r"(?:rs\.?|lkr)\s*([\d,]+(?:\.\d{1,2})?)",
            ],
            "due_date": [
                r"(?:due\s*date|payment\s*due|payment\s*due\s*date|pay\s*before)\s*[:\-]?\s*([0-9]{1,2}[\/\-\.\s][A-Za-z0-9]{1,9}[\/\-\.\s][0-9]{2,4})",
            ],
            "payment_date": [
                r"(?:paid|payment\s*received|payment\s*date)\s*[:\-]?\s*([0-9]{1,2}[\/\-\.\s][A-Za-z0-9]{1,9}[\/\-\.\s][0-9]{2,4})",
            ],
        },
    },

    "PEO TV": {
        # NOTE: must stay before Mobitel/SLT — PEO TV bills carry SLT branding.
        "detect": [
            r"peo\s*tv",
            r"\bpeotv\b",
        ],
        "fields": {
            "customer_name": [
                r"(?:name|customer\s*name|subscriber\s*name|account\s*holder)\s*[:\-]?\s*([A-Z][A-Za-z\s\.]{3,80})",
            ],
            "account_number": [
                r"(?:account\s*(?:no|number|#)|subscriber\s*(?:no|number)|customer\s*(?:no|number)|telephone\s*(?:no|number))\s*[:\-]?\s*([A-Z0-9\-\/\s]{6,25})",
                r"\b(0\d{9})\b",
            ],
            "billing_period": [
                r"(?:billing\s*period|bill\s*period)\s*[:\-]?\s*([A-Za-z0-9\s\/\-\–\.]{5,80})",
                r"([0-9]{1,2}/[0-9]{1,2}/[0-9]{4})\s*[-–]\s*([0-9]{1,2}/[0-9]{1,2}/[0-9]{4})",
            ],
            "amount_due": [
                r"(?:amount\s*due|net\s*payable|total\s*payable|amount\s*payable|total\s*amount|balance\s*due|current\s*charges|monthly\s*rental)\s*[:\-]?\s*(?:rs\.?|lkr)?\s*([\d,]+(?:\.\d{1,2})?)",
                r"(?:rs\.?|lkr)\s*([\d,]+(?:\.\d{1,2})?)",
            ],
            "due_date": [
                r"(?:due\s*(?:date|by)|payment\s*due\s*date|payment\s*due|pay\s*before|payable\s*before)\s*[:\-]?\s*([0-9]{1,2}[\/\-\.\s][A-Za-z0-9]{1,9}[\/\-\.\s][0-9]{2,4})",
            ],
            "payment_date": [
                r"(?:payment\s*date|paid\s*on|date\s*of\s*payment|payment\s*received)\s*[-:\s]*([0-9]{1,2}[\/\-\.\s][A-Za-z0-9]{1,9}[\/\-\.\s][0-9]{2,4})",
            ],
        },
    },

    "Mobitel": {
        "detect": [
            r"sri\s*lanka\s*telecom",
            r"\bslt\b",
            r"\bmobitel\b",
            r"slt\s*mobitel",
            r"sltmobitel",
            r"slmobitel",
            r"slmobitel",
        ],
        "fields": {
            "customer_name": [
                r"(?:name|customer\s*name|subscriber\s*name|account\s*holder)\s*[:\-]?\s*([A-Z][A-Za-z\s\.]{3,80})",
            ],
            "account_number": [
                r"(?:account\s*(?:no|number|#)|subscriber\s*(?:no|number)|customer\s*(?:no|number)|mobile\s*(?:no|number)|telephone\s*(?:no|number))\s*[:\-]?\s*([A-Z0-9\-\/\s]{6,25})",
                r"\b(07[0-9]{8})\b",
            ],
            "billing_period": [
                r"(?:billing\s*period|bill\s*period)\s*[:\-]?\s*([A-Za-z0-9\s\/\-\–\.]{5,80})",
                r"([0-9]{1,2}/[0-9]{1,2}/[0-9]{4})\s*[-–]\s*([0-9]{1,2}/[0-9]{1,2}/[0-9]{4})",
            ],
            "amount_due": [
                r"(?:amount\s*due|net\s*payable|total\s*payable|amount\s*payable|total\s*amount|balance\s*due|current\s*charges)\s*[:\-]?\s*(?:rs\.?|lkr)?\s*([\d,]+(?:\.\d{1,2})?)",
                r"(?:rs\.?|lkr)\s*([\d,]+(?:\.\d{1,2})?)",
            ],
            "due_date": [
                r"(?:due\s*(?:date|by)|payment\s*due\s*date|payment\s*due|pay\s*before|payable\s*before)\s*[:\-]?\s*([0-9]{1,2}[\/\-\.\s][A-Za-z0-9]{1,9}[\/\-\.\s][0-9]{2,4})",
            ],
            "payment_date": [
                r"(?:payment\s*date|paid\s*on|date\s*of\s*payment|payment\s*received|physical\s*payment)\s*[-:\s]*([0-9]{1,2}[\/\-\.\s][A-Za-z0-9]{1,9}[\/\-\.\s][0-9]{2,4})",
            ],
        },
    },

    "Hutch": {
        "detect": [
            r"\bhutch\b",
            r"hutchison",
            r"hutch\s*lanka",
        ],
        "fields": {
            "customer_name": [
                r"(?:name|customer\s*name|subscriber\s*name)\s*[:\-]?\s*([A-Z][A-Za-z\s\.]{3,80})",
            ],
            "account_number": [
                r"(?:account\s*(?:no|number|#)|subscriber\s*(?:no|number)|mobile\s*(?:no|number))\s*[:\-]?\s*([A-Z0-9\-\/\s]{6,25})",
                r"\b(07[0-9]{8})\b",
            ],
            "billing_period": [
                r"(?:billing\s*period|bill\s*period|period)\s*[:\-]?\s*([A-Za-z0-9\s\/\-\–\.]{5,80})",
            ],
            "amount_due": [
                r"(?:amount\s*due|total\s*payable|amount\s*payable|total\s*amount|balance\s*due)\s*[:\-]?\s*(?:rs\.?|lkr)?\s*([\d,]+(?:\.\d{1,2})?)",
                r"(?:rs\.?|lkr)\s*([\d,]+(?:\.\d{1,2})?)",
            ],
            "due_date": [
                r"(?:due\s*date|payment\s*due|pay\s*before)\s*[:\-]?\s*([0-9]{1,2}[\/\-\.\s][A-Za-z0-9]{1,9}[\/\-\.\s][0-9]{2,4})",
            ],
            "payment_date": [
                r"(?:paid|payment\s*received|payment\s*date)\s*[:\-]?\s*([0-9]{1,2}[\/\-\.\s][A-Za-z0-9]{1,9}[\/\-\.\s][0-9]{2,4})",
            ],
        },
    },

    "Airtel": {
        "detect": [
            r"\bairtel\b",
            r"bharti\s*airtel",
            r"airtel\s*lanka",
        ],
        "fields": {
            "customer_name": [
                r"(?:name|customer\s*name|subscriber\s*name)\s*[:\-]?\s*([A-Z][A-Za-z\s\.]{3,80})",
            ],
            "account_number": [
                r"(?:account\s*(?:no|number|#)|subscriber\s*(?:no|number)|mobile\s*(?:no|number))\s*[:\-]?\s*([A-Z0-9\-\/\s]{6,25})",
                r"\b(07[0-9]{8})\b",
            ],
            "billing_period": [
                r"(?:billing\s*period|bill\s*period|period)\s*[:\-]?\s*([A-Za-z0-9\s\/\-\–\.]{5,80})",
            ],
            "amount_due": [
                r"(?:amount\s*due|total\s*payable|amount\s*payable|total\s*amount|balance\s*due)\s*[:\-]?\s*(?:rs\.?|lkr)?\s*([\d,]+(?:\.\d{1,2})?)",
                r"(?:rs\.?|lkr)\s*([\d,]+(?:\.\d{1,2})?)",
            ],
            "due_date": [
                r"(?:due\s*date|payment\s*due|pay\s*before)\s*[:\-]?\s*([0-9]{1,2}[\/\-\.\s][A-Za-z0-9]{1,9}[\/\-\.\s][0-9]{2,4})",
            ],
            "payment_date": [
                r"(?:paid|payment\s*received|payment\s*date)\s*[:\-]?\s*([0-9]{1,2}[\/\-\.\s][A-Za-z0-9]{1,9}[\/\-\.\s][0-9]{2,4})",
            ],
        },
    },

    "Lanka Bell": {
        "detect": [
            r"lanka\s*bell",
            r"\blankabell\b",
        ],
        "fields": {
            "customer_name": [
                r"(?:name|customer\s*name|subscriber\s*name|account\s*holder)\s*[:\-]?\s*([A-Z][A-Za-z\s\.]{3,80})",
            ],
            "account_number": [
                r"(?:account\s*(?:no|number|#)|subscriber\s*(?:no|number)|customer\s*(?:no|number)|telephone\s*(?:no|number))\s*[:\-]?\s*([A-Z0-9\-\/\s]{6,25})",
                r"\b(0\d{9})\b",
            ],
            "billing_period": [
                r"(?:billing\s*period|bill\s*period|period)\s*[:\-]?\s*([A-Za-z0-9\s\/\-\–\.]{5,80})",
            ],
            "amount_due": [
                r"(?:amount\s*due|total\s*payable|amount\s*payable|total\s*amount|balance\s*due|monthly\s*rental)\s*[:\-]?\s*(?:rs\.?|lkr)?\s*([\d,]+(?:\.\d{1,2})?)",
                r"(?:rs\.?|lkr)\s*([\d,]+(?:\.\d{1,2})?)",
            ],
            "due_date": [
                r"(?:due\s*date|payment\s*due|pay\s*before)\s*[:\-]?\s*([0-9]{1,2}[\/\-\.\s][A-Za-z0-9]{1,9}[\/\-\.\s][0-9]{2,4})",
            ],
            "payment_date": [
                r"(?:paid|payment\s*received|payment\s*date)\s*[:\-]?\s*([0-9]{1,2}[\/\-\.\s][A-Za-z0-9]{1,9}[\/\-\.\s][0-9]{2,4})",
            ],
        },
    },

    "Water Board": {
        "detect": [
            r"national\s*water\s*supply",
            r"water\s*board",
            r"\bnwsdb\b",
        ],
        "fields": {
            "customer_name": [
                r"(?:name|customer\s*name|consumer\s*name)\s*[:\-]?\s*([A-Z][A-Za-z\s\.]{3,80})",
            ],
            "account_number": [
                r"(?:consumer|account)\s*(?:no|number|#)\s*[:\-]?\s*([A-Z0-9\-\/\s]{6,25})",
            ],
            "billing_period": [
                r"(?:bill\s*period|billing\s*period|period)\s*[:\-]?\s*([A-Za-z0-9\s\/\-\–\.]{5,80})",
            ],
            "amount_due": [
                r"(?:amount\s*due|total|total\s*amount|balance\s*payable|amount\s*payable)\s*[:\-]?\s*(?:rs\.?|lkr)?\s*([\d,]+(?:\.\d{1,2})?)",
                r"(?:rs\.?|lkr)\s*([\d,]+(?:\.\d{1,2})?)",
            ],
            "due_date": [
                r"(?:due\s*date|payment\s*due\s*date|pay\s*before)\s*[:\-]?\s*([0-9]{1,2}[\/\-\.\s][A-Za-z0-9]{1,9}[\/\-\.\s][0-9]{2,4})",
            ],
            "payment_date": [
                r"(?:paid|date\s*of\s*payment|payment\s*date)\s*[:\-]?\s*([0-9]{1,2}[\/\-\.\s][A-Za-z0-9]{1,9}[\/\-\.\s][0-9]{2,4})",
            ],
        },
    },
}


# ── TEXT EXTRACTION ──────────────────────────────────────────────────

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Three-stage text extraction:
    Stage 1: pdfminer for digital PDFs (instant, exact).
    Stage 2: Baidu Unlimited-OCR VLM for scanned pages (accurate, slow on CPU).
    Stage 3: Tesseract fallback for scanned PDFs.
    """

    text = ""

    if PDFMINER_AVAILABLE:
        try:
            text = pdfminer_extract(io.BytesIO(pdf_bytes), laparams=LAParams())
        except Exception as e:
            print("pdfminer extraction failed:", e)

    if len(text.strip()) >= 100:
        return text or ""

    # Stage 2: Baidu VLM (no-op '' when deps/model unavailable)
    try:
        from app.services.baidu_ocr_service import extract_text_with_baidu
        baidu_text = extract_text_with_baidu(pdf_bytes)
        if len(baidu_text.strip()) >= 100:
            return baidu_text
        # Even a short Baidu result beats nothing; keep as candidate.
        if baidu_text.strip():
            text = baidu_text
    except Exception as e:
        print("Baidu OCR stage failed:", e)

    if len(text.strip()) < 100 and TESSERACT_AVAILABLE:
        try:
            import subprocess
            import tempfile
            import os

            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
                f.write(pdf_bytes)
                tmp_path = f.name

            subprocess.run(
                ["pdftoppm", "-jpeg", "-r", "250", tmp_path, "/tmp/ocr_page"],
                capture_output=True
            )

            os.unlink(tmp_path)

            img_path = "/tmp/ocr_page-1.jpg"

            if os.path.exists(img_path):
                img = Image.open(img_path)
                text = pytesseract.image_to_string(img)
                os.unlink(img_path)

        except Exception as e:
            print("Tesseract OCR fallback failed:", e)

    return text or ""


def clean_text(text: str) -> str:
    """
    Normalizes OCR/PDF text while preserving line breaks.
    """

    if not text:
        return ""

    text = text.replace("\r", "\n")
    text = text.replace("\t", " ")
    text = text.replace(":", ": ")
    text = re.sub(r"[ ]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def get_lines(text: str) -> List[str]:
    """
    Returns non-empty cleaned lines.
    """

    return [line.strip() for line in text.splitlines() if line.strip()]


def detect_biller(text: str) -> Optional[str]:
    """
    Identifies biller from extracted text.
    SLT broadband bills carry both SLT and PeoTV branding — strong SLT
    markers (summary of invoice / telephone+invoice numbers) must win over
    the generic PEO TV patterns, otherwise the wrong parser runs and every
    field comes back 'Not detected'.
    """

    text_lower = text.lower()

    slt_markers = [
        "sltmobitel",
        "sri lanka telecom",
        "summary of invoice",
        "telephone number",
        "total charges for the period",
        "details of payments received",
    ]
    slt_hits = sum(1 for m in slt_markers if m in text_lower)
    has_invoice = bool(re.search(r"\b\d{10}-\d{3,6}\b", text))
    if slt_hits >= 2 or ("sltmobitel" in text_lower) or (
        "summary of invoice" in text_lower and has_invoice
    ):
        return "Mobitel"

    for biller, config in BILLER_PATTERNS.items():
        for pattern in config["detect"]:
            if re.search(pattern, text_lower, re.IGNORECASE):
                return biller

    return None


# ── GENERIC HELPERS ──────────────────────────────────────────────────

def clean_extracted_value(value: Optional[str]) -> Optional[str]:
    """
    Cleans extracted field values.
    """

    if value is None:
        return None

    value = re.sub(r"\s+", " ", str(value)).strip()
    value = value.strip(" :|-–")

    bad_headings = [
        "details of payments received",
        "payment details",
        "details of payment",
        "bill details",
        "summary",
        "summary of invoice",
        "payment slip",
        "customer name",
        "account number",
        "invoice number",
        "billing date",
        "billing period",
        "telephone number",
        "payment due date",
        "total payable",
        "amount",
        "date",
    ]

    if value.lower() in bad_headings:
        return None

    return value


def find_value_after_label(text: str, label: str, max_lookahead: int = 6) -> Optional[str]:
    """
    Finds a value for a label, handling both layouts:
    Same line:  "TELEPHONE NUMBER 0472251520" -> "0472251520"
                "Account Number: 004 288 7993" -> "004 288 7993"
    Next lines: "Account Number" \\n "004 288 7993" -> "004 288 7993"
    """

    lines = get_lines(text)
    label_lower = label.lower()

    bad_values = {
        "invoice number",
        "billing date",
        "billing period",
        "summary of invoice",
        "payment slip",
        "customer name",
        "account number",
        "telephone number",
        "payment due date",
        "total payable",
    }

    for i, line in enumerate(lines):
        line_lower = line.lower()

        if label_lower == line_lower or label_lower in line_lower:
            # 1) Same-line value: strip the label prefix + separators.
            idx = line_lower.find(label_lower)
            same_line = line[idx + len(label_lower):].strip(" :|-–\t")
            same_line = clean_extracted_value(same_line)
            if same_line and same_line.lower() not in bad_values:
                return same_line
            # 2) Fall back to following lines.
            for offset in range(1, max_lookahead + 1):
                if i + offset < len(lines):
                    candidate = clean_extracted_value(lines[i + offset])

                    if not candidate:
                        continue

                    if candidate.lower() in bad_values:
                        continue

                    return candidate

    return None


def make_field(field_name: str, value: Optional[str], confidence: Optional[float] = None) -> Dict:
    """
    Creates a frontend-friendly OCR field object.
    """

    cleaned = clean_extracted_value(value)

    if confidence is None:
        confidence = 0.95 if cleaned else 0.0

    return {
        "field_name": field_name,
        "extracted_value": cleaned,
        "confidence": float(confidence),
        "user_verified": False,
    }


def extract_summary_block(text: str) -> str:
    """
    Extracts the invoice summary section.
    """

    match = re.search(
        r"SUMMARY\s+OF\s+INVOICE([\s\S]*?)(?:DETAILS\s+OF\s+CHARGES|Details\s+of\s+Charges|Dear\s+Valued\s+Customer|Payment\s+Slip)",
        text,
        re.IGNORECASE
    )

    if match:
        return match.group(1)

    return ""


def extract_details_of_charges_block(text: str) -> str:
    """
    Extracts details section if summary block is hard to parse.
    """

    match = re.search(
        r"DETAILS\s+OF\s+CHARGES[\s\S]*?(?:Details\s+of\s+Payments\s+Received|Dear\s+Valued\s+Customer|Payment\s+Slip)",
        text,
        re.IGNORECASE
    )

    if match:
        return match.group(0)

    return ""


def extract_first_phone_number(text: str) -> Optional[str]:
    """
    Finds first likely SLT/Mobitel telephone number.
    """

    match = re.search(r"\b0\d{9}\b", text)
    if match:
        return match.group(0)

    return None


def extract_first_invoice_number(text: str) -> Optional[str]:
    """
    Finds SLT invoice number pattern like 0042887993-0853.
    """

    match = re.search(r"\b\d{10}-\d{3,6}\b", text)
    if match:
        return match.group(0)

    return None


def extract_first_spaced_account_number(text: str) -> Optional[str]:
    """
    Finds SLT account number like 004 288 7993.
    """

    match = re.search(r"\b\d{3}\s+\d{3}\s+\d{4}\b", text)
    if match:
        return match.group(0)

    return None


def extract_date_range(text: str) -> Optional[str]:
    """
    Finds date range like 01/05/2026 - 31/05/2026.
    """

    match = re.search(
        r"\b(\d{1,2}/\d{1,2}/\d{4})\s*[-–]\s*(\d{1,2}/\d{1,2}/\d{4})\b",
        text
    )

    if match:
        return f"{match.group(1)} - {match.group(2)}"

    return None


def extract_customer_name_line(text: str) -> Optional[str]:
    """
    Extracts only the single customer-name line.
    Prevents address lines from being mixed into name.
    """

    lines = get_lines(text)

    for line in lines:
        if re.match(r"^(Mr|Mrs|Ms|Miss|Dr)\.?\s+", line, re.IGNORECASE):
            return clean_extracted_value(line)

    return None


def extract_billing_date(text: str, billing_period: Optional[str]) -> Optional[str]:
    """
    Extracts billing date.
    Prefer label-based value.
    Fallback: first standalone date that is not inside billing period/payment date.
    """

    labelled = find_value_after_label(text, "Billing Date")
    if labelled:
        return labelled

    dates = re.findall(r"\b\d{1,2}/\d{1,2}/\d{4}\b", text)

    if not dates:
        return None

    if billing_period:
        period_dates = re.findall(r"\b\d{1,2}/\d{1,2}/\d{4}\b", billing_period)
        for d in dates:
            if d not in period_dates:
                return d

    return dates[0]


def extract_payment_info(text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Extracts physical payment date and amount.
    Handles layouts like:
    Physical payment-04/05/2026-
    11,500.00
    """

    payment_date = None
    payment_amount = None

    payment_area_match = re.search(
        r"Physical\s+payment[\s\S]{0,120}",
        text,
        re.IGNORECASE
    )

    if payment_area_match:
        payment_area = payment_area_match.group(0)

        date_match = re.search(
            r"\b(\d{1,2}/\d{1,2}/\d{4})\b",
            payment_area
        )

        amount_match = re.search(
            r"\b(\d{1,3}(?:,\d{3})*(?:\.\d{2}))\b",
            payment_area
        )

        if date_match:
            payment_date = date_match.group(1)

        if amount_match:
            payment_amount = amount_match.group(1)

    # Safer fallback over whole text
    if not payment_date:
        date_match = re.search(
            r"Physical\s+payment[-\s]*(\d{1,2}/\d{1,2}/\d{4})",
            text,
            re.IGNORECASE
        )
        if date_match:
            payment_date = date_match.group(1)

    if payment_date and not payment_amount:
        idx = text.lower().find("physical payment")
        if idx != -1:
            snippet = text[idx: idx + 250]
            amounts = re.findall(
                r"\b\d{1,3}(?:,\d{3})*(?:\.\d{2})\b",
                snippet
            )
            if amounts:
                payment_amount = amounts[0]

    return payment_date, payment_amount


def extract_summary_amount_due_and_due_date(text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Extracts total payable and payment due date from SLT summary section.

    In the user's SLT bill:
    Balance B/F
    Payments received
    Charges for the period
    Total payable
    Payment due date

    11,491.10
    -
    11,500.00
    5,665.45
    =
    5,656.55
    22/06/2026
    """

    amount_due = None
    due_date = None

    summary_block = extract_summary_block(text)

    search_area = summary_block if summary_block else text

    # Find due date first.
    dates = re.findall(
        r"\b\d{1,2}/\d{1,2}/\d{4}\b",
        search_area
    )

    if dates:
        # In the summary, payment due date is normally the last date.
        due_date = dates[-1]

    # Find amounts.
    amounts = re.findall(
        r"\b\d{1,3}(?:,\d{3})*(?:\.\d{2})\b",
        search_area
    )

    # Remove obvious payment amount if present in payment section later.
    # For SLT summary, total payable is generally amount before due date and last amount in summary.
    if amounts:
        amount_due = amounts[-1]

    # Stronger fallback: around "Total payable".
    if not amount_due:
        match = re.search(
            r"Total\s+payable[\s\S]{0,250}?(\d{1,3}(?:,\d{3})*(?:\.\d{2}))",
            text,
            re.IGNORECASE
        )
        if match:
            amount_due = match.group(1)

    # Stronger fallback: value immediately before payment due date.
    if due_date and not amount_due:
        before_due = text[: text.find(due_date)]
        amounts_before_due = re.findall(
            r"\b\d{1,3}(?:,\d{3})*(?:\.\d{2})\b",
            before_due
        )
        if amounts_before_due:
            amount_due = amounts_before_due[-1]

    # If due date still missing, try label-based.
    if not due_date:
        due_date = find_value_after_label(text, "Payment due date")

        if not due_date:
            due_match = re.search(
                r"(?:Payment\s+due\s+date|Due\s+date)[\s\S]{0,160}?(\d{1,2}/\d{1,2}/\d{4})",
                text,
                re.IGNORECASE
            )
            if due_match:
                due_date = due_match.group(1)

    # Final fallback:
    # If bill has a summary date after total payable label, pick date near "Payment due date".
    if not due_date:
        lower_text = text.lower()
        idx = lower_text.find("payment due date")
        if idx != -1:
            snippet = text[idx: idx + 300]
            snippet_dates = re.findall(r"\b\d{1,2}/\d{1,2}/\d{4}\b", snippet)
            if snippet_dates:
                due_date = snippet_dates[-1]

    return amount_due, due_date


# ── SLT / MOBITEL SPECIAL PARSER ─────────────────────────────────────

def extract_slt_mobitel_fields(text: str) -> List[Dict]:
    """
    Special parser for SLT/Mobitel eBill layout.
    Handles:
    - labels and values on separate lines
    - text extraction where labels are missing but values are still in order
    - summary table values for total payable and payment due date
    """

    customer_name = extract_customer_name_line(text)

    telephone_number = (
        find_value_after_label(text, "TELEPHONE NUMBER")
        or extract_first_phone_number(text)
    )

    account_number = (
        find_value_after_label(text, "Account Number")
        or extract_first_spaced_account_number(text)
    )

    invoice_number = (
        find_value_after_label(text, "Invoice Number")
        or extract_first_invoice_number(text)
    )

    billing_period = (
        find_value_after_label(text, "Billing Period")
        or extract_date_range(text)
    )

    billing_date = extract_billing_date(text, billing_period)

    amount_due, due_date = extract_summary_amount_due_and_due_date(text)

    payment_date, payment_amount = extract_payment_info(text)

    return [
        make_field("customer_name", customer_name),
        make_field("telephone_number", telephone_number),
        make_field("account_number", account_number),
        make_field("invoice_number", invoice_number),
        make_field("billing_date", billing_date),
        make_field("billing_period", billing_period),
        make_field("amount_due", amount_due),
        make_field("due_date", due_date),
        make_field("payment_date", payment_date),
        make_field("payment_amount", payment_amount),
    ]


# ── GENERIC FIELD EXTRACTION ─────────────────────────────────────────

def extract_fields(text: str, biller: str) -> List[Dict]:
    """
    Extracts structured fields from OCR text.
    """

    patterns = BILLER_PATTERNS.get(biller, {}).get("fields", {})
    results = []

    for field_name, field_patterns in patterns.items():
        value = None
        confidence = 0.0

        if isinstance(field_patterns, str):
            field_patterns = [field_patterns]

        for pattern in field_patterns:
            match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)

            if match:
                if field_name == "billing_period" and len(match.groups()) >= 2:
                    value = f"{match.group(1).strip()} - {match.group(2).strip()}"
                else:
                    value = match.group(1).strip()

                value = clean_extracted_value(value)
                confidence = 0.95 if value else 0.0
                break

        results.append(make_field(field_name, value, confidence))

    return results


def calculate_ocr_confidence(fields: List[Dict]) -> float:
    """
    Overall confidence = average field confidence.
    """

    if not fields:
        return 0.0

    return sum(float(f.get("confidence", 0.0) or 0.0) for f in fields) / len(fields)


def validate_payment_on_time(fields: List[Dict]) -> Optional[bool]:
    """
    Returns True if payment was made on or before due date.
    Returns None if dates cannot be parsed.
    """

    due_date = None
    payment_date = None

    for field in fields:
        if field["field_name"] == "due_date" and field.get("extracted_value"):
            due_date = _parse_date(field["extracted_value"])

        if field["field_name"] == "payment_date" and field.get("extracted_value"):
            payment_date = _parse_date(field["extracted_value"])

    if due_date and payment_date:
        return payment_date <= due_date

    return None


def _parse_date(date_str: str):
    """
    Tries common Sri Lankan date formats.
    """

    from datetime import datetime

    if not date_str:
        return None

    date_str = date_str.strip()

    formats = [
        "%d %B %Y",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%d.%m.%Y",
        "%d %b %Y",
        "%d-%b-%Y",
        "%d/%b/%Y",
        "%Y-%m-%d",
        "%Y/%m/%d",
    ]

    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue

    return None


# ── MAIN PIPELINE ────────────────────────────────────────────────────

def process_bill(pdf_bytes: bytes) -> Dict:
    """
    Full OCR pipeline:
    extract text → clean text → detect biller → extract fields → validate.
    """

    raw_text = extract_text_from_pdf(pdf_bytes)
    cleaned_text = clean_text(raw_text)

    biller = detect_biller(cleaned_text) or "Unknown"

    if biller == "Mobitel":
        fields = extract_slt_mobitel_fields(cleaned_text)
    elif biller != "Unknown":
        fields = extract_fields(cleaned_text, biller)
    else:
        fields = []

    confidence = calculate_ocr_confidence(fields)
    on_time = validate_payment_on_time(fields)

    status = "clean"

    if confidence < 0.5:
        status = "low_confidence"
    elif confidence < 0.8:
        status = "needs_review"

    return {
        "biller_detected": biller,
        "raw_text": cleaned_text,
        "raw_text_length": len(cleaned_text),
        "fields": fields,
        "overall_confidence": confidence,
        "payment_on_time": on_time,
        "status": status,
    }