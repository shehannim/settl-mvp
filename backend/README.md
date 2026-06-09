# Settl Backend

Alternative credit intelligence API — FastAPI + XGBoost + Supabase.

## Project structure

```
settl_backend/
├── app/
│   ├── core/
│   │   ├── config.py          # Environment variables
│   │   ├── security.py        # JWT auth
│   │   └── database.py        # Supabase client
│   ├── models/
│   │   └── schemas.py         # Pydantic request/response models
│   ├── routers/
│   │   ├── auth.py            # POST /api/auth/register, /login
│   │   ├── kyc.py             # POST /api/kyc/verify-nic, /verify-otp
│   │   ├── connect.py         # GET /api/connect/paypal (OAuth)
│   │   ├── ingest.py          # POST /api/ingest/utility-bill
│   │   ├── score.py           # POST /api/score/compute
│   │   └── lender.py          # GET /api/lender/query/{settl_id}
│   ├── services/
│   │   ├── kyc_service.py     # NIC validation, OTP
│   │   ├── paypal_service.py  # PayPal OAuth + transactions
│   │   ├── ocr_service.py     # PDF extraction + biller validation
│   │   ├── normalisation_service.py  # Feature engineering
│   │   └── scoring_service.py # XGBoost inference + SHAP
│   └── main.py                # FastAPI app + routers
├── scripts/
│   └── train_model.py         # Generate synthetic data + train XGBoost
├── model/                     # Created by train_model.py
│   ├── settl_model.pkl
│   └── shap_explainer.pkl
├── supabase_schema.sql        # Run in Supabase SQL Editor
├── requirements.txt
├── Dockerfile
└── .env.example
```

## Setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd settl_backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Fill in `.env`:
- `SUPABASE_URL` and `SUPABASE_KEY` — from your Supabase project settings
- `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` — from developer.paypal.com
- `EXCHANGE_RATE_API_KEY` — from exchangerate-api.com (free tier)
- `SECRET_KEY` — any random string, e.g. `openssl rand -hex 32`

### 3. Set up Supabase database

1. Create a new project at supabase.com
2. Go to SQL Editor
3. Paste and run the contents of `supabase_schema.sql`
4. Go to Storage → create a bucket called `bills` → set to private

### 4. Set up PayPal developer app

1. Go to developer.paypal.com
2. Create a new app under Sandbox
3. Copy Client ID and Secret into `.env`
4. Add `http://localhost:8000/api/connect/paypal/callback` as a return URL

### 5. Train the scoring model

```bash
python scripts/train_model.py
```

This generates 2,000 synthetic profiles, trains the XGBoost model, and saves:
- `model/settl_model.pkl`
- `model/shap_explainer.pkl`

Expected output:
```
Validation AUC: 0.83xx  (target >= 0.78)
Precision at 0.5: 0.79xx  (target >= 0.72)
```

### 6. Run the development server

```bash
uvicorn app.main:app --reload --port 8000
```

API is live at `http://localhost:8000`
Interactive docs at `http://localhost:8000/docs`

---

## API endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | None | Register user |
| POST | /api/auth/login | None | Login user |
| POST | /api/auth/lender/login | None | Login lender |
| POST | /api/kyc/verify-nic | User JWT | Validate NIC, trigger OTP |
| POST | /api/kyc/verify-otp | User JWT | Confirm OTP |
| GET | /api/kyc/status | User JWT | Get KYC status |
| GET | /api/connect/paypal | User JWT | Start PayPal OAuth |
| GET | /api/connect/sources | User JWT | List connected sources |
| POST | /api/ingest/utility-bill | User JWT | Upload PDF bill |
| POST | /api/ingest/ocr-review | User JWT | Confirm OCR fields |
| POST | /api/score/compute | User JWT | Compute score |
| GET | /api/score/result | User JWT | Get latest score |
| GET | /api/score/history | User JWT | Score history |
| GET | /api/lender/query/{settl_id} | Lender JWT | Query applicant score |
| POST | /api/lender/outcome | Lender JWT | Report loan outcome |

---

## Demo flow

1. `POST /api/auth/register` → get JWT
2. `POST /api/kyc/verify-nic` with `199012345678`
3. `POST /api/kyc/verify-otp` with `123456`
4. `GET /api/connect/paypal` → follow OAuth URL
5. `POST /api/ingest/utility-bill` with a CEB PDF
6. `POST /api/ingest/ocr-review` to confirm fields
7. `POST /api/score/compute` → get score 300–850
8. `GET /api/score/result` → score + confidence + SHAP

---

## Deployment on Railway

1. Push to GitHub
2. Create new Railway project → Deploy from GitHub repo
3. Add environment variables in Railway dashboard
4. Railway uses the Dockerfile automatically
5. Your API URL will be `https://your-app.railway.app`

Update `PAYPAL_REDIRECT_URI` in `.env` to use the Railway URL.

---

## Notes for demo

- OTP is hardcoded as `123456` in demo mode
- PayPal uses Sandbox mode — use sandbox test accounts
- The scoring model is trained on synthetic data — results are illustrative
- Total infrastructure cost: $0 (all free tiers)
