USE healthnexus;

CREATE TABLE IF NOT EXISTS email_verification_code (
  id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  email       VARCHAR(255) NOT NULL,
  purpose     ENUM('registration','password_reset') NOT NULL,
  code_hash   CHAR(64) NOT NULL,
  expires_at  DATETIME NOT NULL,
  attempts    INT NOT NULL DEFAULT 0,
  used_at     DATETIME NULL,
  requested_ip VARCHAR(45) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_verification_lookup (email, purpose, used_at),
  INDEX idx_email_verification_expires (expires_at)
);
