-- Generate predicted RUL values (red-line style) for each bearing
-- using the amount of batches available in vibration_readings.
--
-- Output:
--   Inserts one row in rul_readings per vibration batch and bearing.
--
-- Notes:
-- - Profiles can be assigned by exact bearing name (see bearing_profile_map).
-- - If no explicit mapping exists, fallback is by bearing order (name ASC) and loops every 11 bearings.
-- - This script REPLACES existing rul_readings content.
-- - batch_number in rul_readings is expected to be auto-assigned by trigger.

BEGIN;

DELETE FROM rul_readings;

WITH bearing_order AS (
  SELECT
    b.id AS bearing_id,
    b.name,
    ROW_NUMBER() OVER (ORDER BY b.name, b.id) AS bearing_idx
  FROM bearings b
  WHERE EXISTS (
    SELECT 1
    FROM vibration_readings vr
    WHERE vr.bearing_id = b.id
  )
),
bearing_profile_map AS (
  -- Map each bearing name to a specific profile to mimic the red curves from the provided image.
  -- Adjust names here to match your real bearing names in table `bearings`.
  SELECT *
  FROM (
    VALUES
      ('Bearing1_3', 1),
      ('Bearing1_4', 2),
      ('Bearing1_5', 3),
      ('Bearing1_6', 4),
      ('Bearing1_7', 5),
      ('Bearing2_3', 6),
      ('Bearing2_4', 7),
      ('Bearing2_5', 8),
      ('Bearing2_6', 9),
      ('Bearing2_7', 10),
      ('Bearing3_3', 11)
  ) AS m(bearing_name, profile_idx)
),
profiles AS (
  -- profile_idx, start_rul, end_floor, linear_drop,
  -- p1, m1, k1, p2, m2, k2, step_start, step_mag, noise_1, noise_2
  SELECT *
  FROM (
    VALUES
      (1, 95.0, 10.0, 58.0, 0.45, 18.0, 40.0, 0.78, 12.0, 25.0, 0.62, 1.8, 0.9, 0.5),
      (2, 96.0,  9.0, 60.0, 0.50, 22.0, 45.0, 0.82, 18.0, 30.0, 0.70, 2.0, 1.0, 0.5),
      (3, 94.0,  7.0, 46.0, 0.30,  8.0, 30.0, 0.55, 14.0, 20.0, 0.40, 3.2, 1.2, 0.6),
      (4, 95.0,  8.0, 74.0, 0.62,  8.0, 28.0, 0.86,  8.0, 24.0, 0.68, 1.2, 0.6, 0.3),
      (5, 96.0, 10.0, 50.0, 0.42, 22.0, 42.0, 0.76, 15.0, 28.0, 0.56, 2.6, 1.0, 0.5),
      (6, 92.0, 14.0, 32.0, 0.48, 46.0, 60.0, 0.58,  0.0, 20.0, 0.45, 0.4, 0.3, 0.2),
      (7, 93.0, 18.0, 72.0, 0.65,  6.0, 24.0, 0.83,  6.0, 20.0, 0.70, 0.9, 0.5, 0.2),
      (8, 94.0, 16.0, 58.0, 0.25, 20.0, 35.0, 0.68, 10.0, 20.0, 0.52, 1.6, 0.8, 0.4),
      (9, 90.0, 26.0, 46.0, 0.50, 24.0, 55.0, 0.66,  0.0, 16.0, 0.45, 0.2, 0.35, 0.2),
      (10,88.0, 66.0, 20.0, 0.18,  7.0, 22.0, 0.35,  0.0,  4.0, 0.30, 0.0, 0.25, 0.15),
      (11,91.0, 11.0, 56.0, 0.40, 12.0, 18.0, 0.72, 14.0, 20.0, 0.60, 1.4, 0.7, 0.35)
  ) AS p(
    profile_idx, start_rul, end_floor, linear_drop,
    p1, m1, k1, p2, m2, k2, step_start, step_mag, noise_1, noise_2
  )
),
vibration_ranked AS (
  SELECT
    vr.bearing_id,
    vr.batch_number,
    vr.created_at,
    ROW_NUMBER() OVER (
      PARTITION BY vr.bearing_id
      ORDER BY vr.batch_number
    ) AS rn,
    COUNT(*) OVER (
      PARTITION BY vr.bearing_id
    ) AS total_rows
  FROM vibration_readings vr
),
vibration_with_profile AS (
  SELECT
    vr.bearing_id,
    vr.batch_number,
    vr.created_at,
    vr.rn,
    vr.total_rows,
    bo.bearing_idx,
    COALESCE(
      bpm.profile_idx,
      ((bo.bearing_idx - 1) % 11) + 1
    ) AS profile_idx
  FROM vibration_ranked vr
  JOIN bearing_order bo
    ON bo.bearing_id = vr.bearing_id
  LEFT JOIN bearing_profile_map bpm
    ON bpm.bearing_name = bo.name
),
curve_raw AS (
  SELECT
    vwp.bearing_id,
    vwp.rn,
    vwp.created_at,
    vwp.total_rows,
    p.end_floor,
    (
      CASE
        WHEN vwp.total_rows <= 1 THEN 0::numeric
        ELSE ((vwp.rn - 1)::numeric / (vwp.total_rows - 1))
      END
    ) AS t,
    p.start_rul,
    p.linear_drop,
    p.p1, p.m1, p.k1,
    p.p2, p.m2, p.k2,
    p.step_start, p.step_mag,
    p.noise_1, p.noise_2
  FROM vibration_with_profile vwp
  JOIN profiles p
    ON p.profile_idx = vwp.profile_idx
),
curve_pred AS (
  SELECT
    c.bearing_id,
    c.rn,
    c.created_at,
    GREATEST(
      c.end_floor,
      LEAST(
        100.0,
        c.start_rul
        - (c.linear_drop * c.t)
        - (c.m1 * (1.0 / (1.0 + EXP(-c.k1 * (c.t - c.p1)))))
        - (c.m2 * (1.0 / (1.0 + EXP(-c.k2 * (c.t - c.p2)))))
        - (
            CASE
              WHEN c.t > c.step_start
                THEN c.step_mag * FLOOR((c.t - c.step_start) / 0.065)
              ELSE 0
            END
          )
        + (c.noise_1 * SIN((c.rn * 0.043) + (c.p1 * 12.0)))
        + (c.noise_2 * SIN((c.rn * 0.117) + (c.p2 * 9.0)))
      )
    ) AS rul_pct
  FROM curve_raw c
),
curve_limited AS (
  SELECT
    cp.bearing_id,
    cp.rn,
    cp.created_at,
    LEAST(
      cp.rul_pct,
      COALESCE(
        LAG(cp.rul_pct) OVER (
          PARTITION BY cp.bearing_id
          ORDER BY cp.rn
        ) + 0.35,
        cp.rul_pct
      )
    ) AS rul_pct
  FROM curve_pred cp
)
INSERT INTO rul_readings (
  bearing_id,
  rul_percentage,
  created_at
)
SELECT
  cl.bearing_id,
  ROUND(cl.rul_pct::numeric, 2),
  COALESCE(cl.created_at, NOW())
FROM curve_limited cl
ORDER BY cl.bearing_id, cl.rn;

COMMIT;
