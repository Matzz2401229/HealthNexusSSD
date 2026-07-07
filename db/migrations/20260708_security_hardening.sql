USE healthnexus;

SET @needs_users_deleted_at := (
  SELECT COUNT(*) = 0
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'deleted_at'
);
SET @sql := IF(
  @needs_users_deleted_at,
  'ALTER TABLE users ADD COLUMN deleted_at DATETIME NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @needs_announcement_deleted_at := (
  SELECT COUNT(*) = 0
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'announcement'
    AND COLUMN_NAME = 'deleted_at'
);
SET @sql := IF(
  @needs_announcement_deleted_at,
  'ALTER TABLE announcement ADD COLUMN deleted_at DATETIME NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @needs_sessions_user_id := (
  SELECT COUNT(*) = 0
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sessions'
    AND COLUMN_NAME = 'user_id'
);
SET @sql := IF(
  @needs_sessions_user_id,
  'ALTER TABLE sessions ADD COLUMN user_id BIGINT UNSIGNED NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @needs_sessions_user_idx := (
  SELECT COUNT(*) = 0
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sessions'
    AND INDEX_NAME = 'idx_sessions_user'
);
SET @sql := IF(
  @needs_sessions_user_idx,
  'ALTER TABLE sessions ADD INDEX idx_sessions_user (user_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DELETE FROM sessions WHERE user_id IS NULL;

DROP TRIGGER IF EXISTS trg_auditlog_no_update;
DROP TRIGGER IF EXISTS trg_auditlog_no_delete;

DELIMITER $$
CREATE TRIGGER trg_auditlog_no_update
BEFORE UPDATE ON auditlog
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Audit log records are immutable';
END$$

CREATE TRIGGER trg_auditlog_no_delete
BEFORE DELETE ON auditlog
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Audit log records are immutable';
END$$
DELIMITER ;

-- For Docker-created databases, least-privilege grants are applied by
-- db/99-privileges.sh using MYSQL_USER and MYSQL_DATABASE from the environment.
