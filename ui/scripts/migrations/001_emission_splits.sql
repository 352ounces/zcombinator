-- Migration: Add emission_splits table and validation
-- Run with: psql $DB_URL -f scripts/migrations/001_emission_splits.sql

-- Create emission_splits table
CREATE TABLE IF NOT EXISTS emission_splits (
  id SERIAL PRIMARY KEY,
  token_address TEXT NOT NULL,
  recipient_wallet TEXT NOT NULL,
  split_percentage DECIMAL(5,2) NOT NULL,
  label TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

  UNIQUE(token_address, recipient_wallet),
  CHECK(split_percentage > 0 AND split_percentage <= 100),
  FOREIGN KEY (token_address) REFERENCES token_launches(token_address) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_emission_splits_token ON emission_splits(token_address);
CREATE INDEX IF NOT EXISTS idx_emission_splits_recipient ON emission_splits(recipient_wallet);

-- Create validation function
CREATE OR REPLACE FUNCTION validate_emission_splits_total()
RETURNS TRIGGER AS $$
DECLARE
  total_percentage DECIMAL(5,2);
BEGIN
  SELECT COALESCE(SUM(split_percentage), 0) INTO total_percentage
  FROM emission_splits
  WHERE token_address = NEW.token_address;

  IF total_percentage > 100.00 THEN
    RAISE EXCEPTION 'Total emission splits exceed 100 percent (currently: %)', total_percentage;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS check_splits_total ON emission_splits;
CREATE TRIGGER check_splits_total
  AFTER INSERT OR UPDATE ON emission_splits
  FOR EACH ROW
  EXECUTE FUNCTION validate_emission_splits_total();

-- Verify installation
\echo 'Emission splits migration completed successfully!'
\echo 'Verifying installation...'
SELECT
  'emission_splits table' AS object,
  CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END AS status
FROM information_schema.tables
WHERE table_name = 'emission_splits'
UNION ALL
SELECT
  'validate_emission_splits_total function' AS object,
  CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END AS status
FROM information_schema.routines
WHERE routine_name = 'validate_emission_splits_total'
UNION ALL
SELECT
  'check_splits_total trigger' AS object,
  CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END AS status
FROM information_schema.triggers
WHERE trigger_name = 'check_splits_total';
