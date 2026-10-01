-- Settl — Demo lender accounts (password for all: demo1234)
-- Run in Supabase SQL Editor. Safe to re-run (upsert by email).

INSERT INTO lenders (email, password_hash, institution_name, min_score, min_confidence)
VALUES
  ('credit@ruhunafinance.demo', '$2b$12$gvOB4tMJWHDU9Y8EQTTJku4r2nXl0xTZiGikqU.xcoPIT4uCYc.Fm', 'Ruhuna Finance PLC', 620, 0.50),
  ('risk@ceylonsme.demo', '$2b$12$6r4IlUMb.JtBDfcMqqfRIuAlNxb0eyCDLwMVdiBqkEkDcyFf/NbNW', 'Ceylon SME Bank', 680, 0.65),
  ('underwriting@metroleasing.demo', '$2b$12$tZE66/9ym0qAN4JLlL6tX.JtFEF2XTid7vtMfPCWJhtP3BEcwKsYG', 'Metro Leasing Ltd', 700, 0.70)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  institution_name = EXCLUDED.institution_name,
  min_score = EXCLUDED.min_score,
  min_confidence = EXCLUDED.min_confidence;

-- Verify:
-- SELECT email, institution_name, min_score, min_confidence, created_at FROM lenders WHERE email LIKE '%demo';
