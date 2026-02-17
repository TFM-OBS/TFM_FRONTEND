-- Drop the global sequence approach and use per-bearing batch numbering
DROP TRIGGER IF EXISTS set_batch_number ON rul_readings;
DROP FUNCTION IF EXISTS set_batch_number();
DROP SEQUENCE IF EXISTS rul_readings_batch_seq;

-- Create a function that sets batch_number per bearing
CREATE OR REPLACE FUNCTION set_batch_number_per_bearing()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the next batch number for this specific bearing
  SELECT COALESCE(MAX(batch_number), 0) + 1 INTO NEW.batch_number
  FROM rul_readings
  WHERE bearing_id = NEW.bearing_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-set batch_number before insert
CREATE TRIGGER set_batch_number_per_bearing
  BEFORE INSERT ON rul_readings
  FOR EACH ROW
  EXECUTE FUNCTION set_batch_number_per_bearing();

-- Clear existing data and regenerate with per-bearing batch numbers
DELETE FROM rul_readings;

-- Insert sample data for each bearing with sequential batch numbers per bearing
DO $$
DECLARE
  bearing RECORD;
  i INT;
  base_rul NUMERIC;
  current_rul NUMERIC;
BEGIN
  FOR bearing IN SELECT id, name FROM bearings LOOP
    -- Set different starting RUL for each bearing to show variety
    CASE bearing.name
      WHEN 'ROD-001' THEN base_rul := 95;
      WHEN 'ROD-002' THEN base_rul := 78;
      WHEN 'ROD-003' THEN base_rul := 45;
      WHEN 'ROD-004' THEN base_rul := 15;
      WHEN 'ROD-005' THEN base_rul := 88;
      ELSE base_rul := 80;
    END CASE;
    
    -- Generate 15 readings per bearing (batch 1 to 15)
    FOR i IN 1..15 LOOP
      -- Simulate degradation over batches (slight decrease with some variation)
      current_rul := GREATEST(0, base_rul - (i * 1.5) + (random() * 3 - 1.5));
      
      INSERT INTO rul_readings (bearing_id, rul_percentage, created_at)
      VALUES (
        bearing.id,
        ROUND(current_rul::numeric, 1),
        NOW() - ((15 - i) * INTERVAL '1 day') + (random() * INTERVAL '12 hours')
      );
    END LOOP;
  END LOOP;
END $$;
