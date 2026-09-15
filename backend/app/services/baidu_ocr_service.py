"""
Baidu Unlimited-OCR service — vision-language OCR for scanned Sri Lankan bills.

Uses the `baidu/Unlimited-OCR` checkpoint (already in local HF cache).
Heavy deps (torch/transformers) are OPTIONAL: everything imports lazily so the
API boots fine without them. If unavailable, callers fall back to
pdfminer/tesseract in ocr_service.py.

Official recipe: transformers==4.57.1, prompt '<image>document parsing.',
gundam config (base_size=1024, image_size=640, crop_mode=True),
no_repeat_ngram_size=35, ngram_window=128.
"""
import io
import logging
import os
import tempfile
import threading
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger(__name__)

MODEL_ID = os.getenv("BAIDU_OCR_MODEL_ID", "baidu/Unlimited-OCR")
ENABLED = os.getenv("BAIDU_OCR_ENABLED", "true").lower() not in ("0", "false", "no")
MAX_PAGES = int(os.getenv("BAIDU_OCR_MAX_PAGES", "2"))

_lock = threading.Lock()
_model = None
_tokenizer = None
_load_error: Optional[str] = None


def _apply_compat_patches() -> None:
    """CPU-only + version-compat shims for the vendored model code."""
    import torch

    if getattr(torch.Tensor.cuda, "__module__", "") != "baidu_ocr_service":
        def _cpu_cuda(self, *a, **k):
            return self
        _cpu_cuda.__module__ = "baidu_ocr_service"
        torch.Tensor.cuda = _cpu_cuda

    try:
        from transformers.cache_utils import DynamicCache as _DC
        if hasattr(_DC, "get_max_length") and not getattr(_DC, "_baidu_patched", False):
            _orig = _DC.get_max_length

            def _fixed(self):
                try:
                    v = _orig(self)
                except ValueError:
                    return None
                return None if (v is not None and v < 0) else v

            _DC.get_max_length = _fixed
            _DC._baidu_patched = True
    except ImportError:
        pass


def _patch_config(config) -> None:
    """Fill attrs the vendored (transformers 4.46-era) code expects."""
    defaults = {
        "pad_token_id": config.eos_token_id,
        "attention_bias": False,
        "attention_dropout": 0.0,
        "aux_loss_alpha": 0.001,
        "ep_size": 1,
        "hidden_act": "silu",
        "initializer_range": 0.02,
        "moe_layer_freq": 1,
        "n_layers": getattr(config, "num_hidden_layers", 12),
        "n_positions": getattr(config, "max_position_embeddings", 32768),
        "norm_topk_prob": False,
        "rms_norm_eps": 1e-6,
        "rope_theta": 10000.0,
        "rope_scaling": None,
        "rope_parameters": {"rope_type": "default", "rope_theta": 10000.0},
        "routed_scaling_factor": 1.0,
        "scoring_func": "softmax",
        "seq_aux": True,
        "_attn_implementation": "eager",
        "cache_implementation": None,
        "is_decoder": True,
    }
    for k, v in defaults.items():
        try:
            getattr(config, k)
        except AttributeError:
            setattr(config, k, v)
    try:
        config.rope_parameters = {"rope_type": "default", "rope_theta": 10000.0}
    except Exception:
        pass
    # Disable ring/sliding-window attention (fights modern DynamicCache;
    # bills are short context so plain attention is fine).
    for attr in ("sliding_window", "sliding_window_size", "_ring_window"):
        try:
            setattr(config, attr, None)
        except Exception:
            pass


def baidu_ocr_available() -> bool:
    """True if the VLM can be loaded (deps + checkpoint present)."""
    if not ENABLED:
        return False
    try:
        import torch  # noqa: F401
        from transformers import AutoConfig  # noqa: F401
    except ImportError:
        return False
    if _load_error is not None:
        return False
    return True


def _get_model():
    global _model, _tokenizer, _load_error
    if _model is not None:
        return _model, _tokenizer
    with _lock:
        if _model is not None:
            return _model, _tokenizer
        try:
            import torch
            import transformers.utils.import_utils as _iu
            if not hasattr(_iu, "is_torch_fx_available"):
                _iu.is_torch_fx_available = lambda: False
            _apply_compat_patches()
            from transformers import AutoModel, AutoTokenizer, AutoConfig

            logger.info("Loading Baidu Unlimited-OCR model (%s)...", MODEL_ID)
            _tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
            if _tokenizer.pad_token is None:
                _tokenizer.pad_token = _tokenizer.eos_token
            config = AutoConfig.from_pretrained(MODEL_ID, trust_remote_code=True)
            _patch_config(config)
            _model = AutoModel.from_pretrained(
                MODEL_ID, config=config, trust_remote_code=True,
                torch_dtype="auto",
            ).eval()
            # Checkpoint omits CLIP position_ids (garbage on load) — restore.
            for _name, _mod in _model.named_modules():
                if hasattr(_mod, "position_embedding") and hasattr(_mod, "position_ids"):
                    w, p = _mod.position_embedding.weight, _mod.position_ids
                    if int(p.max()) >= w.shape[0]:
                        _mod.register_buffer(
                            "position_ids", torch.arange(w.shape[0]).expand((1, -1)))
            # Keep decode position_ids aligned with inputs (prevents rotary
            # broadcast bug that splits K/V lengths).
            _orig_prep = _model.prepare_inputs_for_generation

            def _fix_prep(_self, input_ids, *args, **kwargs):
                r = _orig_prep(input_ids, *args, **kwargs)
                ri, rp = r.get("input_ids"), r.get("position_ids")
                if rp is not None and ri is not None and rp.shape[1] != ri.shape[1]:
                    r["position_ids"] = rp[:, -ri.shape[1]:]
                return r

            import types
            _model.prepare_inputs_for_generation = types.MethodType(_fix_prep, _model)
            logger.info("Baidu Unlimited-OCR model loaded.")
        except Exception as e:
            _load_error = str(e)
            logger.warning("Baidu OCR unavailable, will fall back: %s", e)
            raise
        return _model, _tokenizer


def ocr_image_file(image_path: str, prompt: str = "<image>document parsing.") -> str:
    """Run Baidu VLM OCR on one image file. Returns extracted text."""
    import torch

    model, tokenizer = _get_model()
    with tempfile.TemporaryDirectory(prefix="baidu_ocr_") as tmp:
        with torch.no_grad():
            out = model.infer(
                tokenizer,
                prompt=prompt,
                image_file=image_path,
                output_path=tmp,
                base_size=1024,
                image_size=640,
                crop_mode=True,
                max_length=4096,
                no_repeat_ngram_size=35,
                ngram_window=128,
                eval_mode=True,
            )
    if not out:
        return ""
    # Strip grounding markers, keep readable text lines.
    lines = []
    for raw in str(out).splitlines():
        line = raw.strip()
        if not line:
            continue
        lines.append(line)
    return "\n".join(lines)


def ocr_pdf_pages(pdf_bytes: bytes, dpi: int = 200) -> str:
    """Render scanned-PDF pages and OCR them with the Baidu VLM."""
    try:
        import fitz  # PyMuPDF
    except ImportError:
        logger.warning("PyMuPDF not installed, skipping Baidu PDF OCR.")
        return ""
    texts: List[str] = []
    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        for i, page in enumerate(doc):
            if i >= MAX_PAGES:
                break
            pix = page.get_pixmap(matrix=fitz.Matrix(dpi / 72, dpi / 72))
            img_bytes = pix.tobytes("png")
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
                f.write(img_bytes)
                tmp_path = f.name
            try:
                texts.append(ocr_image_file(tmp_path))
            finally:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
    return "\n\n".join(t for t in texts if t.strip())


def extract_text_with_baidu(pdf_bytes: bytes) -> str:
    """Public entry: '' when unavailable so callers can fall back."""
    if not baidu_ocr_available():
        return ""
    try:
        return ocr_pdf_pages(pdf_bytes)
    except Exception as e:
        logger.warning("Baidu OCR pass failed, falling back: %s", e)
        return ""
