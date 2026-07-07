-- =====================================================================
-- HealthNexus — SHARED DEVELOPMENT SEED
-- =====================================================================
-- Working login accounts + sample data so the whole team has a consistent
-- local dataset. Real bcrypt hashes, so these accounts actually log in.
--
-- !!! DEVELOPMENT ONLY — NEVER load this in production (NFSR8). It is NOT
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
--   pending.doctor@test.com  doctor       PENDING  (approve via admin)
--   patient2@test.com        patient      active
--   doctor2@test.com         doctor       active / approved
--   patient3@test.com        patient      active
--   doctor3@test.com         doctor       active / approved
-- ---------------------------------------------------------------------
USE healthnexus;

-- --- Clean up any previous run of this seed (idempotent) --------------
SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM document_request     WHERE document_id IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12) OR requester_id IN (2, 3, 4, 7, 9) OR id IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
DELETE FROM medical_document     WHERE id IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12) OR patient_id IN (1, 6, 8);
DELETE FROM prescription        WHERE patient_id IN (1, 6, 8) OR doctor_id IN (2, 5, 7, 9);
DELETE FROM diagnosis           WHERE doctor_id IN (2, 5, 7, 9);
DELETE FROM appointment         WHERE id IN (1, 2, 3) OR patient_id IN (1, 6, 8) OR doctor_id IN (2, 5, 7, 9);
DELETE FROM doctor_patient_auth WHERE doctor_id IN (2, 5, 7, 9) OR patient_id IN (1, 6, 8);
DELETE FROM patient             WHERE id IN (1, 6, 8);
DELETE FROM doctor              WHERE id IN (2, 5, 7, 9);
DELETE FROM pharmacist          WHERE id = 3;
DELETE FROM admin               WHERE id = 4;
DELETE FROM users               WHERE id IN (1, 2, 3, 4, 5, 6, 7, 8, 9);
SET FOREIGN_KEY_CHECKS = 1;

-- --- Accounts --------------------------------------------------------
-- password_hash = bcrypt(cost 12) of 'Password123!'
INSERT INTO users (id, email, password_hash, role, is_active, email_verified, approval_status) VALUES
  (1, 'patient@test.com',        '$2a$12$vO.62WrvfFTOrM5RhulHaOTKLbL3lWGg7vFqyNE3LyUlZYtEQNbVy', 'patient',    TRUE,  TRUE, 'approved'),
  (2, 'doctor@test.com',         '$2a$12$vO.62WrvfFTOrM5RhulHaOTKLbL3lWGg7vFqyNE3LyUlZYtEQNbVy', 'doctor',     TRUE,  TRUE, 'approved'),
  (3, 'pharmacist@test.com',     '$2a$12$vO.62WrvfFTOrM5RhulHaOTKLbL3lWGg7vFqyNE3LyUlZYtEQNbVy', 'pharmacist', TRUE,  TRUE, 'approved'),
  (4, 'admin@test.com',          '$2a$12$vO.62WrvfFTOrM5RhulHaOTKLbL3lWGg7vFqyNE3LyUlZYtEQNbVy', 'admin',      TRUE,  TRUE, 'approved'),
  -- Extra doctor left PENDING so the admin approval flow can be exercised.
  (5, 'pending.doctor@test.com', '$2a$12$vO.62WrvfFTOrM5RhulHaOTKLbL3lWGg7vFqyNE3LyUlZYtEQNbVy', 'doctor',     FALSE, TRUE, 'pending'),
  (6, 'patient2@test.com',       '$2a$12$vO.62WrvfFTOrM5RhulHaOTKLbL3lWGg7vFqyNE3LyUlZYtEQNbVy', 'patient',    TRUE,  TRUE, 'approved'),
  (7, 'doctor2@test.com',        '$2a$12$vO.62WrvfFTOrM5RhulHaOTKLbL3lWGg7vFqyNE3LyUlZYtEQNbVy', 'doctor',     TRUE,  TRUE, 'approved'),
  (8, 'patient3@test.com',       '$2a$12$vO.62WrvfFTOrM5RhulHaOTKLbL3lWGg7vFqyNE3LyUlZYtEQNbVy', 'patient',    TRUE,  TRUE, 'approved'),
  (9, 'doctor3@test.com',        '$2a$12$vO.62WrvfFTOrM5RhulHaOTKLbL3lWGg7vFqyNE3LyUlZYtEQNbVy', 'doctor',     TRUE,  TRUE, 'approved');

-- --- Role profiles ---------------------------------------------------
INSERT INTO patient (id, full_name, dob) VALUES
  (1, 'Test Patient',  '1990-05-01'),
  (6, 'Patient Two',   '1985-11-18'),
  (8, 'Patient Three', '1978-02-24');
INSERT INTO admin   (id, full_name)       VALUES (4, 'Test Admin');
INSERT INTO doctor  (id, full_name, specialty, approved_by) VALUES
  (2, 'Dr Alice Tan', 'General Practice', 4),    -- approved by the admin (id 4)
  (5, 'Dr Ben Ong',   'Radiology',        NULL), -- pending, not yet approved
  (7, 'Dr Chandra Lim', 'Endocrinology',  4),
  (9, 'Dr Maya Koh',    'Cardiology',     4);
INSERT INTO pharmacist (id, full_name, pharmacy)
  VALUES (3, 'Test Pharmacist', 'Central Pharmacy');

-- --- Treatment relationship + appointment (authorises the doctor, FSR4)
INSERT INTO doctor_patient_auth (doctor_id, patient_id) VALUES
  (2, 1),
  (7, 6),
  (9, 8);
INSERT INTO appointment (id, patient_id, doctor_id, scheduled_at, status) VALUES
  (1, 1, 2, '2026-07-10 09:00:00', 'completed'),
  (2, 6, 7, '2026-07-12 11:30:00', 'completed'),
  (3, 8, 9, '2026-07-14 15:00:00', 'completed');

-- --- Diagnosis note against that appointment -------------------------
INSERT INTO diagnosis (appointment_id, doctor_id, remarks) VALUES
  (1, 2, 'Mild throat infection. Prescribed antibiotics; review in 1 week.'),
  (2, 7, 'Reviewed endocrine panel and recommended follow-up lifestyle monitoring.'),
  (3, 9, 'Cardiology review completed; no acute symptoms reported.');

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

-- --- Sample medical documents for patient 1 --------------------------
-- These rows seed the document UI / API with realistic patient records.
-- Only records uploaded by the patient should expose the patient-side delete
-- action in the UI. Clinician-authored records are therefore seeded with the
-- doctor as uploader.
-- Generate matching local PDF files after loading this seed:
--
--   docker compose exec backend npm run seed:documents
INSERT INTO medical_document
  (id, patient_id, uploaded_by, stored_name, original_name, mime_type, size_bytes, sha256, category, description, status)
VALUES
  (
    1, 1, 2,
    '11111111-1111-1111-1111-111111111111.pdf',
    'Full Blood Count Report - 12 Mar 2026.pdf',
    'application/pdf',
    248736,
    '1111111111111111111111111111111111111111111111111111111111111111',
    'lab',
    'Routine laboratory panel requested after annual primary care review.',
    'active'
  ),
  (
    2, 1, 2,
    '22222222-2222-2222-2222-222222222222.pdf',
    'Specialist Referral Letter - Cardiology.pdf',
    'application/pdf',
    132480,
    '2222222222222222222222222222222222222222222222222222222222222222',
    'referral',
    'Referral letter prepared for cardiology follow-up assessment.',
    'active'
  ),
  (
    3, 1, 2,
    '33333333-3333-3333-3333-333333333333.pdf',
    'Chest X-Ray Summary - Follow-up.pdf',
    'application/pdf',
    198420,
    '3333333333333333333333333333333333333333333333333333333333333333',
    'imaging',
    'Imaging summary uploaded after respiratory follow-up appointment.',
    'active'
  ),
  (
    4, 1, 2,
    '44444444-4444-4444-4444-444444444444.pdf',
    'HbA1c Monitoring Result - 02 Apr 2026.pdf',
    'application/pdf',
    154210,
    '4444444444444444444444444444444444444444444444444444444444444444',
    'lab',
    'Quarterly diabetes monitoring result uploaded for ongoing chronic care review.',
    'active'
  ),
  (
    5, 1, 1,
    '55555555-5555-5555-5555-555555555555.pdf',
    'Discharge Summary - Community Hospital.pdf',
    'application/pdf',
    286930,
    '5555555555555555555555555555555555555555555555555555555555555555',
    'general',
    'Hospital discharge summary covering follow-up medication and care instructions.',
    'active'
  ),
  (
    6, 1, 2,
    '66666666-6666-6666-6666-666666666666.pdf',
    'Respiratory Medication Review - May 2026.pdf',
    'application/pdf',
    121604,
    '6666666666666666666666666666666666666666666666666666666666666666',
    'prescription',
    'Medication review notes uploaded to support ongoing respiratory treatment.',
    'active'
  ),
  (
    7, 6, 7,
    '77777777-7777-7777-7777-777777777777.pdf',
    'Allergy Test Report - Patient Two.pdf',
    'application/pdf',
    142000,
    '7777777777777777777777777777777777777777777777777777777777777777',
    'lab',
    'Allergy panel results reviewed during endocrine follow-up.',
    'active'
  ),
  (
    8, 6, 7,
    '88888888-8888-8888-8888-888888888888.pdf',
    'MRI Knee Summary - Patient Two.pdf',
    'application/pdf',
    215000,
    '8888888888888888888888888888888888888888888888888888888888888888',
    'imaging',
    'Imaging summary for knee pain raised during follow-up care.',
    'active'
  ),
  (
    9, 6, 6,
    '99999999-9999-9999-9999-999999999999.pdf',
    'Diabetes Review Notes - Patient Two.pdf',
    'application/pdf',
    176000,
    '9999999999999999999999999999999999999999999999999999999999999999',
    'general',
    'Patient-uploaded chronic care notes for diabetes monitoring.',
    'active'
  ),
  (
    10, 8, 9,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.pdf',
    'Cardiology Follow-up Letter - Patient Three.pdf',
    'application/pdf',
    164000,
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'referral',
    'Follow-up cardiology letter prepared after specialist review.',
    'active'
  ),
  (
    11, 8, 8,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.pdf',
    'Vaccination History - Patient Three.pdf',
    'application/pdf',
    99000,
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'general',
    'Patient-uploaded vaccination history for continuity of care.',
    'active'
  ),
  (
    12, 8, 9,
    'cccccccc-cccc-cccc-cccc-cccccccccccc.pdf',
    'Renal Function Lab Result - Patient Three.pdf',
    'application/pdf',
    131000,
    'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    'lab',
    'Renal function panel reviewed alongside cardiology follow-up.',
    'active'
  );

-- --- Sample document access requests ---------------------------------
-- These requests provide active and historical examples in the UI.
INSERT INTO document_request
  (id, document_id, requester_id, requested_role, reason, status, reviewed_by, reviewed_at)
VALUES
  (
    1, 1, 2, 'doctor',
    'Need the latest blood report to continue treatment planning.',
    'approved',
    1,
    NOW()
  ),
  (
    2, 2, 4, 'admin',
    'Administrative review of the specialist referral record.',
    'pending',
    NULL,
    NULL
  ),
  (
    3, 3, 2, 'doctor',
    'Historical imaging request denied after patient review.',
    'denied',
    1,
    NOW()
  ),
  (
    4, 4, 2, 'doctor',
    'Need the latest HbA1c result for chronic care follow-up.',
    'approved',
    1,
    NOW()
  ),
  (
    5, 5, 4, 'admin',
    'Operational review of discharge documentation attached to the patient record.',
    'approved',
    1,
    NOW()
  ),
  (
    6, 6, 2, 'doctor',
    'Requesting medication review notes to assess current respiratory treatment plan.',
    'pending',
    NULL,
    NULL
  ),
  (
    7, 7, 7, 'doctor',
    'Need allergy panel context for Patient Two follow-up.',
    'approved',
    6,
    NOW()
  ),
  (
    8, 8, 7, 'doctor',
    'Need MRI summary to compare against current mobility symptoms.',
    'pending',
    NULL,
    NULL
  ),
  (
    9, 10, 9, 'doctor',
    'Need cardiology follow-up letter for Patient Three continuity of care.',
    'approved',
    8,
    NOW()
  ),
  (
    10, 11, 4, 'admin',
    'Governance review for patient-submitted vaccination history.',
    'pending',
    NULL,
    NULL
  );
