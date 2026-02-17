-- Modify rul_readings table to use batch numbers instead of timestamp for ordering
-- Add batch_number as autoincremental and created_at for the actual insertion date

-- First, drop the old timestamp column and add new columns
ALTER TABLE rul_readings DROP COLUMN IF EXISTS timestamp;

-- Add batch_number column with auto-increment per bearing
ALTER TABLE rul_readings ADD COLUMN IF NOT EXISTS batch_number SERIAL;

-- Add created_at column for the actual insertion timestamp
ALTER TABLE rul_readings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Delete existing sample data
DELETE FROM rul_readings;

-- Reset the sequence for batch_number
ALTER SEQUENCE rul_readings_batch_number_seq RESTART WITH 1;

-- Bearing 1: Decreasing RUL (normal wear) - starts at ~85%
INSERT INTO rul_readings (bearing_id, rul_percentage, created_at)
SELECT 
  '11111111-1111-1111-1111-111111111111',
  GREATEST(0, LEAST(100, 85 - (i * 0.5) + (random() * 2 - 1))),
  NOW() - (30 - i) * INTERVAL '1 day'
FROM generate_series(0, 30) AS i;

-- Bearing 2: Stable RUL (good condition) - starts at ~92%
INSERT INTO rul_readings (bearing_id, rul_percentage, created_at)
SELECT 
  '22222222-2222-2222-2222-222222222222',
  GREATEST(0, LEAST(100, 92 - (i * 0.2) + (random() * 1.5 - 0.75))),
  NOW() - (30 - i) * INTERVAL '1 day'
FROM generate_series(0, 30) AS i;

-- Bearing 3: Rapidly decreasing RUL (needs attention) - starts at ~45%
INSERT INTO rul_readings (bearing_id, rul_percentage, created_at)
SELECT 
  '33333333-3333-3333-3333-333333333333',
  GREATEST(0, LEAST(100, 45 - (i * 0.8) + (random() * 3 - 1.5))),
  NOW() - (30 - i) * INTERVAL '1 day'
FROM generate_series(0, 30) AS i;

-- Bearing 4: Very good condition - starts at ~98%
INSERT INTO rul_readings (bearing_id, rul_percentage, created_at)
SELECT 
  '44444444-4444-4444-4444-444444444444',
  GREATEST(0, LEAST(100, 98 - (i * 0.15) + (random() * 1 - 0.5))),
  NOW() - (30 - i) * INTERVAL '1 day'
FROM generate_series(0, 30) AS i;

-- Bearing 5: Critical condition - starts at ~18%
INSERT INTO rul_readings (bearing_id, rul_percentage, created_at)
SELECT 
  '55555555-5555-5555-5555-555555555555',
  GREATEST(0, LEAST(100, 18 - (i * 0.4) + (random() * 2 - 1))),
  NOW() - (30 - i) * INTERVAL '1 day'
FROM generate_series(0, 30) AS i;
