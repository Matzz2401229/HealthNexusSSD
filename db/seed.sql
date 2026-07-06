-- =====================================================================
-- HealthNexus — SHARED DEV SEED  (LOCAL / DEMO USE ONLY)
-- =====================================================================
-- Working login accounts + sample data so the whole team has a consistent
-- demo dataset. Real bcrypt hashes, so these accounts actually log in.
--
-- !!! DEV / DEMO ONLY — NEVER load this in production (NFSR8). It is NOT
-- !!! auto-loaded: only db/init.sql runs on DB init. Load it by hand:
--
--   docker compose exec -T db sh -c \
--     'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" healthnexus' < db/seed.sql
--
-- Best run on a fresh DB (right after init). Safe to re-run: the cleanup
-- block below removes any previously-seeded rows first.
--
-- ---------------------------------------------------------------------
-- LOGINS  (all password: Password123! )
--   patient@test.com         patient      active
--   doctor@test.com          doctor       active / approved
--   pharmacist@test.com      pharmacist   active / approved
--   admin@test.com           admin        active
--   pending.doctor@test.com  doctor       PENDING  (approve via admin — demo)
-- ---------------------------------------------------------------------
USE healthnexus;

-- --- Clean up any previous run of this seed (idempotent) --------------
SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM prescription        WHERE patient_id IN (1) OR doctor_id IN (2, 5);
DELETE FROM diagnosis           WHERE doctor_id IN (2, 5);
DELETE FROM appointment         WHERE id = 1 OR patient_id IN (1) OR doctor_id IN (2, 5);
DELETE FROM doctor_patient_auth WHERE doctor_id IN (2, 5) OR patient_id IN (1);
DELETE FROM patient             WHERE id = 1;
DELETE FROM doctor              WHERE id IN (2, 5);
DELETE FROM pharmacist          WHERE id = 3;
DELETE FROM admin               WHERE id = 4;
DELETE FROM users               WHERE id IN (1, 2, 3, 4, 5);
SET FOREIGN_KEY_CHECKS = 1;

-- --- Accounts --------------------------------------------------------
-- password_hash = bcrypt(cost 12) of 'Password123!'
INSERT INTO users (id, email, password_hash, role, is_active, email_verified, approval_status) VALUES
  (1, 'patient@test.com',        '$2a$12$vO.62WrvfFTOrM5RhulHaOTKLbL3lWGg7vFqyNE3LyUlZYtEQNbVy', 'patient',    TRUE,  TRUE, 'approved'),
  (2, 'doctor@test.com',         '$2a$12$vO.62WrvfFTOrM5RhulHaOTKLbL3lWGg7vFqyNE3LyUlZYtEQNbVy', 'doctor',     TRUE,  TRUE, 'approved'),
  (3, 'pharmacist@test.com',     '$2a$12$vO.62WrvfFTOrM5RhulHaOTKLbL3lWGg7vFqyNE3LyUlZYtEQNbVy', 'pharmacist', TRUE,  TRUE, 'approved'),
  (4, 'admin@test.com',          '$2a$12$vO.62WrvfFTOrM5RhulHaOTKLbL3lWGg7vFqyNE3LyUlZYtEQNbVy', 'admin',      TRUE,  TRUE, 'approved'),
  -- Extra doctor left PENDING so the admin approval flow can be demoed.
  (5, 'pending.doctor@test.com', '$2a$12$vO.62WrvfFTOrM5RhulHaOTKLbL3lWGg7vFqyNE3LyUlZYtEQNbVy', 'doctor',     FALSE, TRUE, 'pending');

-- --- Role profiles ---------------------------------------------------
INSERT INTO patient (id, full_name, dob)  VALUES (1, 'Test Patient', '1990-05-01');
INSERT INTO admin   (id, full_name)       VALUES (4, 'Test Admin');
INSERT INTO doctor  (id, full_name, specialty, approved_by) VALUES
  (2, 'Dr Alice Tan', 'General Practice', 4),    -- approved by the admin (id 4)
  (5, 'Dr Ben Ong',   'Radiology',        NULL); -- pending, not yet approved
INSERT INTO pharmacist (id, full_name, pharmacy)
  VALUES (3, 'Test Pharmacist', 'Central Pharmacy');

-- --- Treatment relationship + appointment (authorises the doctor, FSR4)
INSERT INTO doctor_patient_auth (doctor_id, patient_id) VALUES (2, 1);
INSERT INTO appointment (id, patient_id, doctor_id, scheduled_at, status)
  VALUES (1, 1, 2, '2026-07-10 09:00:00', 'completed');

-- --- Diagnosis note against that appointment -------------------------
INSERT INTO diagnosis (appointment_id, doctor_id, remarks)
  VALUES (1, 2, 'Mild throat infection. Prescribed antibiotics; review in 1 week.');

-- --- Sample prescriptions for patient 1, issued by doctor 2 ----------
-- One PENDING (shows in the pharmacy queue) + one already DISPENSED.
INSERT INTO prescription
  (patient_id, doctor_id, appointment_id, medication, dosage, instructions, status, fulfilment_status)
VALUES
  (1, 2, 1, 'Amoxicillin', '500mg', 'Take twice daily after food', 'issued', 'pending');

INSERT INTO prescription
  (patient_id, doctor_id, appointment_id, medication, dosage, instructions, status, fulfilment_status, fulfilled_by, fulfilled_at)
VALUES
  (1, 2, 1, 'Paracetamol', '500mg', 'Take as needed for pain', 'issued', 'dispensed', 3, NOW());
