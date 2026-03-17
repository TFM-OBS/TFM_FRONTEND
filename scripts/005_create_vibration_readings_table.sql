-- Create vibration_readings table for per-batch feature history
-- Compatible with DEMO4-Upload-features-supabase.py

CREATE TABLE IF NOT EXISTS vibration_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bearing_id UUID NOT NULL REFERENCES bearings(id) ON DELETE CASCADE,
  batch_number INTEGER NOT NULL,
  vibration_horizontal NUMERIC NOT NULL,
  vibration_vertical NUMERIC NOT NULL,
  rms NUMERIC,
  source_file TEXT,
  segment_idx INTEGER,
  feature_timestamp DOUBLE PRECISION,
  pelt_label INTEGER,
  condition INTEGER,
  rul_percentage NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE vibration_readings
  ADD COLUMN IF NOT EXISTS rms NUMERIC;

-- Ensure one batch per bearing
CREATE UNIQUE INDEX IF NOT EXISTS idx_vibration_readings_bearing_batch
  ON vibration_readings(bearing_id, batch_number);

CREATE INDEX IF NOT EXISTS idx_vibration_readings_bearing_id
  ON vibration_readings(bearing_id);

CREATE INDEX IF NOT EXISTS idx_vibration_readings_created_at
  ON vibration_readings(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vibration_readings_feature_timestamp
  ON vibration_readings(feature_timestamp);

-- Enable row level security
ALTER TABLE vibration_readings ENABLE ROW LEVEL SECURITY;

-- Public policies matching the rest of the demo setup
DROP POLICY IF EXISTS "Allow public read on vibration_readings" ON vibration_readings;
DROP POLICY IF EXISTS "Allow public insert on vibration_readings" ON vibration_readings;

CREATE POLICY "Allow public read on vibration_readings"
  ON vibration_readings
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on vibration_readings"
  ON vibration_readings
  FOR INSERT
  WITH CHECK (true);

-- Auto-increment batch_number per bearing
CREATE OR REPLACE FUNCTION set_vibration_batch_number_per_bearing()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.batch_number IS NULL OR NEW.batch_number <= 0 THEN
    SELECT COALESCE(MAX(vr.batch_number), 0) + 1
    INTO NEW.batch_number
    FROM vibration_readings vr
    WHERE vr.bearing_id = NEW.bearing_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_vibration_batch_number_per_bearing ON vibration_readings;

CREATE TRIGGER set_vibration_batch_number_per_bearing
  BEFORE INSERT ON vibration_readings
  FOR EACH ROW
  EXECUTE FUNCTION set_vibration_batch_number_per_bearing();
