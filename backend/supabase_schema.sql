-- ═══════════════════════════════════════════════════════
--  Settl — Supabase PostgreSQL Schema
--  Run this in the Supabase SQL Editor to set up all tables
-- ═══════════════════════════════════════════════════════

-- ── USERS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settl_id                    TEXT UNIQUE NOT NULL,
    email                       TEXT UNIQUE NOT NULL,
    full_name                   TEXT NOT NULL,
    password_hash               TEXT NOT NULL,
    nic_number                  TEXT,
    nic_validated_at            TIMESTAMPTZ,
    kyc_verified                BOOLEAN DEFAULT FALSE,
    otp_verified                BOOLEAN DEFAULT FALSE,
    kyc_completed_at            TIMESTAMPTZ,
    connected_source_count      INT DEFAULT 0,
    digital_tenure_months       INT DEFAULT 0,
    identity_consistency_score  FLOAT DEFAULT 0.5,
    fraud_flag_count            INT DEFAULT 0,
    bill_ontime_rate            FLOAT DEFAULT 0.5,
    bill_count                  INT DEFAULT 0,
    created_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- ── LENDERS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lenders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               TEXT UNIQUE NOT NULL,
    password_hash       TEXT NOT NULL,
    institution_name    TEXT NOT NULL,
    min_score           INT DEFAULT 650,
    min_confidence      FLOAT DEFAULT 0.60,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── CONNECTED SOURCES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS connected_sources (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
    source              TEXT NOT NULL,           -- paypal | stripe | upwork | etc.
    account_name        TEXT,
    transaction_count   INT DEFAULT 0,
    date_range_months   INT DEFAULT 0,
    income_features     JSONB,
    access_token_hash   TEXT,                    -- hash only, never raw token
    connected_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, source)
);

-- ── PENDING BILLS (not yet confirmed by user) ────────────
CREATE TABLE IF NOT EXISTS pending_bills (
    id                  UUID PRIMARY KEY,
    user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
    storage_path        TEXT,
    biller_detected     TEXT,
    fields              JSONB,
    overall_confidence  FLOAT,
    identity_match_score FLOAT DEFAULT 0.5,
    payment_on_time     BOOLEAN,
    status              TEXT DEFAULT 'clean',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── VERIFIED BILLS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS verified_bills (
    id                  UUID PRIMARY KEY,
    user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
    storage_path        TEXT,
    biller_detected     TEXT,
    fields              JSONB,
    overall_confidence  FLOAT,
    identity_match_score FLOAT DEFAULT 0.5,
    payment_on_time     BOOLEAN,
    confirmed_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── SCORES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scores (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID REFERENCES users(id) ON DELETE CASCADE,
    score                   INT NOT NULL,
    band                    TEXT NOT NULL,
    confidence              FLOAT NOT NULL,
    confidence_breakdown    JSONB,
    categories              JSONB,
    top_positive_factors    JSONB,
    top_negative_factors    JSONB,
    improvement_tips        JSONB,
    feature_vector          JSONB,
    model_version           TEXT,
    computed_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ── LOAN OUTCOMES (model feedback loop) ─────────────────
CREATE TABLE IF NOT EXISTS loan_outcomes (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID REFERENCES users(id) ON DELETE CASCADE,
    lender_id               UUID REFERENCES lenders(id),
    score_at_decision       INT,
    confidence_at_decision  FLOAT,
    model_version           TEXT,
    decision                TEXT,           -- approved | declined | conditional
    loan_amount_lkr         INT,
    repayment_status        TEXT DEFAULT 'pending',  -- on_time | late_<30 | defaulted | pending
    reported_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ── AUDIT LOG ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event               TEXT NOT NULL,
    user_id             UUID,
    lender_id           UUID,
    lender_institution  TEXT,
    score_queried       INT,
    details             JSONB,
    queried_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEXES ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_scores_user_id ON scores(user_id);
CREATE INDEX IF NOT EXISTS idx_scores_computed_at ON scores(computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_bills_user_id ON verified_bills(user_id);
CREATE INDEX IF NOT EXISTS idx_sources_user_id ON connected_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_model_version ON loan_outcomes(model_version);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_log(user_id);

-- ── ROW LEVEL SECURITY ───────────────────────────────────
-- Enable RLS on sensitive tables
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE verified_bills   ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores           ENABLE ROW LEVEL SECURITY;

-- Users can only read their own data
CREATE POLICY "users_own_data" ON users
    FOR ALL USING (auth.uid()::text = id::text);

CREATE POLICY "sources_own_data" ON connected_sources
    FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "bills_own_data" ON verified_bills
    FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "scores_own_data" ON scores
    FOR ALL USING (auth.uid()::text = user_id::text);

-- ── STORAGE BUCKET ───────────────────────────────────────
-- Run in Supabase Storage tab: create a bucket called "bills"
-- Set it to private (not public)
-- Enable encryption at rest (default in Supabase)
