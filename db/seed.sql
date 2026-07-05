-- =====================================================================
-- HealthNexus — DEV seed data (LOCAL TESTING ONLY).
-- Loads a few fake accounts + sample prescriptions so the app has something
-- to show before the real registration/login flow is built.
--
-- Run manually against your LOCAL dev database (NOT auto-loaded, NOT for prod):
--   docker compose exec -T db mysql -uroot -p"<root-password>" healthnexus < db/seed.sql
--
-- The password_hash values are placeholders — real login isn't wired yet, and
-- in dev we fake the logged-in user (see the dev fake-login shim).
-- =====================================================================
USE healthnexus;

-- --- Fake accounts ---------------------------------------------------
INSERT INTO users (id, email, password_hash, role, is_active, email_verified) VALUES
  (1, 'patient@test.local',    '$2a$12$devPLACEHOLDERhashNOTusableForRealLoginXXXXXXXXXXXXXXXX', 'patient',    TRUE, TRUE),
  (2, 'doctor@test.local',     '$2a$12$devPLACEHOLDERhashNOTusableForRealLoginXXXXXXXXXXXXXXXX', 'doctor',     TRUE, TRUE),
  (3, 'pharmacist@test.local', '$2a$12$devPLACEHOLDERhashNOTusableForRealLoginXXXXXXXXXXXXXXXX', 'pharmacist', TRUE, TRUE),
  (4, 'admin@test.local',      '$2a$12$devPLACEHOLDERhashNOTusableForRealLoginXXXXXXXXXXXXXXXX', 'admin',      TRUE, TRUE);

-- --- Role profiles ---------------------------------------------------
INSERT INTO patient (id, full_name, dob)        VALUES (1, 'Test Patient', '1990-05-01');
INSERT INTO admin (id, full_name)               VALUES (4, 'Test Admin');
INSERT INTO doctor (id, full_name, specialty, approved_by)
  VALUES (2, 'Dr Test', 'General Practice', 4);
INSERT INTO pharmacist (id, full_name, pharmacy)
  VALUES (3, 'Test Pharmacist', 'Central Pharmacy');

-- --- Treatment relationship + appointment (so the doctor may prescribe, FSR4)
INSERT INTO doctor_patient_auth (doctor_id, patient_id) VALUES (2, 1);
INSERT INTO appointment (id, patient_id, doctor_id, scheduled_at, status)
  VALUES (1, 1, 2, '2026-07-10 09:00:00', 'completed');

-- --- Sample prescriptions for patient 1, issued by doctor 2 ----------
INSERT INTO prescription
  (patient_id, doctor_id, appointment_id, medication, dosage, instructions, status, fulfilment_status)
VALUES
  (1, 2, 1, 'Amoxicillin', '500mg', 'Take twice daily after food', 'issued', 'pending');

INSERT INTO prescription
  (patient_id, doctor_id, appointment_id, medication, dosage, instructions, status, fulfilment_status, fulfilled_by, fulfilled_at)
VALUES
  (1, 2, 1, 'Paracetamol', '500mg', 'Take as needed for pain', 'issued', 'dispensed', 3, NOW());
