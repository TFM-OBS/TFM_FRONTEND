-- Create bearings table
CREATE TABLE IF NOT EXISTS bearings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  machine TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create RUL readings table
CREATE TABLE IF NOT EXISTS rul_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bearing_id UUID NOT NULL REFERENCES bearings(id) ON DELETE CASCADE,
  rul_hours NUMERIC NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_rul_readings_bearing_id ON rul_readings(bearing_id);
CREATE INDEX IF NOT EXISTS idx_rul_readings_timestamp ON rul_readings(timestamp DESC);

-- Enable RLS (optional, can be disabled for public read)
ALTER TABLE bearings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rul_readings ENABLE ROW LEVEL SECURITY;

-- Allow public read access (no auth required)
CREATE POLICY "Allow public read on bearings" ON bearings FOR SELECT USING (true);
CREATE POLICY "Allow public read on rul_readings" ON rul_readings FOR SELECT USING (true);
CREATE POLICY "Allow public insert on bearings" ON bearings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert on rul_readings" ON rul_readings FOR INSERT WITH CHECK (true);

-- Insert sample bearings
INSERT INTO bearings (id, name, location, machine) VALUES
  ('11111111-1111-1111-1111-111111111111', 'ROD-001', 'Sector A', 'Compresor Principal'),
  ('22222222-2222-2222-2222-222222222222', 'ROD-002', 'Sector A', 'Compresor Principal'),
  ('33333333-3333-3333-3333-333333333333', 'ROD-003', 'Sector B', 'Motor Bomba'),
  ('44444444-4444-4444-4444-444444444444', 'ROD-004', 'Sector B', 'Ventilador Industrial'),
  ('55555555-5555-5555-5555-555555555555', 'ROD-005', 'Sector C', 'Turbina');

-- Insert sample RUL readings (last 30 days of data for each bearing)
-- Bearing 1: Decreasing RUL (normal wear)
INSERT INTO rul_readings (bearing_id, rul_hours, timestamp)
SELECT 
  '11111111-1111-1111-1111-111111111111',
  2500 - (i * 8) + (random() * 20 - 10),
  NOW() - (30 - i) * INTERVAL '1 day'
FROM generate_series(0, 30) AS i;

-- Bearing 2: Stable RUL (good condition)
INSERT INTO rul_readings (bearing_id, rul_hours, timestamp)
SELECT 
  '22222222-2222-2222-2222-222222222222',
  4200 - (i * 3) + (random() * 15 - 7.5),
  NOW() - (30 - i) * INTERVAL '1 day'
FROM generate_series(0, 30) AS i;

-- Bearing 3: Rapidly decreasing RUL (needs attention)
INSERT INTO rul_readings (bearing_id, rul_hours, timestamp)
SELECT 
  '33333333-3333-3333-3333-333333333333',
  800 - (i * 15) + (random() * 30 - 15),
  NOW() - (30 - i) * INTERVAL '1 day'
FROM generate_series(0, 30) AS i;

-- Bearing 4: Very good condition
INSERT INTO rul_readings (bearing_id, rul_hours, timestamp)
SELECT 
  '44444444-4444-4444-4444-444444444444',
  6000 - (i * 5) + (random() * 25 - 12.5),
  NOW() - (30 - i) * INTERVAL '1 day'
FROM generate_series(0, 30) AS i;

-- Bearing 5: Critical condition
INSERT INTO rul_readings (bearing_id, rul_hours, timestamp)
SELECT 
  '55555555-5555-5555-5555-555555555555',
  350 - (i * 8) + (random() * 20 - 10),
  NOW() - (30 - i) * INTERVAL '1 day'
FROM generate_series(0, 30) AS i;
