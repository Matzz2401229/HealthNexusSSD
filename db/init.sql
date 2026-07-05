-- =====================================================================
-- HealthNexus schema (D1 §9.7). Mounted by docker-compose into MySQL.
-- FK integrity enforced; doctor_patient_auth backs the doctor->patient
-- authorisation checks (FSR4). This is a SKELETON — refine columns per
-- workstream, but keep the table set and the restricted app-user grants.
-- =====================================================================
CREATE DATABASE IF NOT EXISTS healthnexus
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE healthnexus;

-- --- Core identity ---------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id             BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  email          VARCHAR(255) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,               -- bcrypt/argon2 only; never plaintext
  role           ENUM('patient','doctor','pharmacist','admin') NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT FALSE,       -- doctors inactive until admin approval
  approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  failed_logins  INT NOT NULL DEFAULT 0,
  locked_until   DATETIME NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- --- Role profile tables --------------------------------------------
CREATE TABLE IF NOT EXISTS patient (
  id         BIGINT UNSIGNED PRIMARY KEY,
  full_name  VARCHAR(255) NOT NULL,
  dob        DATE NULL,
  FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS doctor (
  id            BIGINT UNSIGNED PRIMARY KEY,
  full_name     VARCHAR(255) NOT NULL,
  specialty     VARCHAR(255) NULL,
  approved_by   BIGINT UNSIGNED NULL,                 -- admin who approved (FSR13)
  FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS pharmacist (
  id         BIGINT UNSIGNED PRIMARY KEY,
  full_name  VARCHAR(255) NOT NULL,
  pharmacy   VARCHAR(255) NULL,
  FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin (
  id         BIGINT UNSIGNED PRIMARY KEY,
  full_name  VARCHAR(255) NOT NULL,
  FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
);

-- --- Treatment relationship (backs FSR4 doctor->patient authz) -------
CREATE TABLE IF NOT EXISTS doctor_patient_auth (
  id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  doctor_id   BIGINT UNSIGNED NOT NULL,
  patient_id  BIGINT UNSIGNED NOT NULL,
  granted_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at  DATETIME NULL,
  UNIQUE KEY uq_doctor_patient (doctor_id, patient_id),
  FOREIGN KEY (doctor_id)  REFERENCES doctor(id)  ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES patient(id) ON DELETE CASCADE
);

-- --- Clinical --------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointment (
  id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  patient_id  BIGINT UNSIGNED NOT NULL,
  doctor_id   BIGINT UNSIGNED NOT NULL,
  scheduled_at DATETIME NOT NULL,
  status      ENUM('booked','cancelled','completed','rescheduled') NOT NULL DEFAULT 'booked',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patient(id),
  FOREIGN KEY (doctor_id)  REFERENCES doctor(id)
);

CREATE TABLE IF NOT EXISTS diagnosis (
  id             BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  appointment_id BIGINT UNSIGNED NOT NULL,
  doctor_id      BIGINT UNSIGNED NOT NULL,
  remarks        TEXT NULL,                            -- output-encode on render (FSR11)
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointment(id),
  FOREIGN KEY (doctor_id)      REFERENCES doctor(id)
);

CREATE TABLE IF NOT EXISTS prescription (
  id           BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  patient_id   BIGINT UNSIGNED NOT NULL,
  doctor_id    BIGINT UNSIGNED NOT NULL,
  -- medication/dosage/issuer are immutable once issued (enforced in service layer)
  medication   VARCHAR(255) NOT NULL,
  dosage       VARCHAR(255) NOT NULL,
  status       ENUM('issued','fulfilled','cancelled') NOT NULL DEFAULT 'issued',
  issued_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fulfilled_by BIGINT UNSIGNED NULL,                   -- pharmacist updates status only
  FOREIGN KEY (patient_id)   REFERENCES patient(id),
  FOREIGN KEY (doctor_id)    REFERENCES doctor(id),
  FOREIGN KEY (fulfilled_by) REFERENCES pharmacist(id)
);

CREATE TABLE IF NOT EXISTS medical_document (
  id            BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  patient_id    BIGINT UNSIGNED NOT NULL,
  uploaded_by   BIGINT UNSIGNED NOT NULL,
  stored_name   VARCHAR(255) NOT NULL,                 -- random UUID name, stored outside web root
  original_name VARCHAR(255) NOT NULL,
  mime_type     VARCHAR(100) NOT NULL,                 -- verified via magic bytes, not client header
  size_bytes    INT UNSIGNED NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id)  REFERENCES patient(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS document_request (
  id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  document_id BIGINT UNSIGNED NOT NULL,
  requester_id BIGINT UNSIGNED NOT NULL,
  status      ENUM('pending','approved','denied') NOT NULL DEFAULT 'pending',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id)  REFERENCES medical_document(id),
  FOREIGN KEY (requester_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS announcement (
  id         BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  author_id  BIGINT UNSIGNED NOT NULL,
  title      VARCHAR(255) NOT NULL,
  body       TEXT NOT NULL,                            -- output-encode on render (FSR11)
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

-- --- Audit log (append-only, hash-chained; D1 §9.3) -----------------
CREATE TABLE IF NOT EXISTS auditlog (
  id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NULL,
  role        VARCHAR(32) NULL,
  action      VARCHAR(100) NOT NULL,
  target      VARCHAR(255) NULL,
  ip_address  VARCHAR(45) NULL,
  result      ENUM('success','failure') NOT NULL,
  prev_hash   CHAR(64) NULL,                           -- SHA-256 of previous row
  entry_hash  CHAR(64) NOT NULL,                       -- SHA-256(prev_hash + this row)
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  -- NB: never store passwords, tokens, or clinical content here.
);

-- --- Session store (express-mysql-session) --------------------------
CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
  expires    INT UNSIGNED NOT NULL,
  data       MEDIUMTEXT COLLATE utf8mb4_bin,
  PRIMARY KEY (session_id)
) ENGINE=InnoDB;

-- =====================================================================
-- Restricted application DB user (D1 §9.6): SELECT/INSERT/UPDATE only.
-- No DROP/CREATE/admin. Password comes from the environment.
-- DELETE is granted ONLY on `sessions` (needed for logout + expiry),
-- never on clinical tables.
-- =====================================================================
CREATE USER IF NOT EXISTS 'healthnexus_app'@'%' IDENTIFIED BY 'change_me_app_password';
GRANT SELECT, INSERT, UPDATE ON healthnexus.* TO 'healthnexus_app'@'%';
GRANT DELETE ON healthnexus.sessions TO 'healthnexus_app'@'%';
FLUSH PRIVILEGES;