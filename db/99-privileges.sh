#!/bin/sh
set -eu

mysql --protocol=socket -uroot -p"${MYSQL_ROOT_PASSWORD}" <<SQL
SET @app_user := REPLACE('${MYSQL_USER}', '''', '''''');
SET @schema_name := REPLACE('${MYSQL_DATABASE}', '`', '``');

SET @sql := CONCAT('REVOKE ALL PRIVILEGES, GRANT OPTION FROM ''', @app_user, '''@''%''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := CONCAT('GRANT SELECT, INSERT, UPDATE ON `', @schema_name, '`.users TO ''', @app_user, '''@''%''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := CONCAT('GRANT SELECT, INSERT, UPDATE ON `', @schema_name, '`.patient TO ''', @app_user, '''@''%''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := CONCAT('GRANT SELECT, INSERT, UPDATE ON `', @schema_name, '`.doctor TO ''', @app_user, '''@''%''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := CONCAT('GRANT SELECT, INSERT, UPDATE ON `', @schema_name, '`.pharmacist TO ''', @app_user, '''@''%''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := CONCAT('GRANT SELECT, INSERT, UPDATE ON `', @schema_name, '`.admin TO ''', @app_user, '''@''%''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := CONCAT('GRANT SELECT, INSERT, UPDATE ON `', @schema_name, '`.doctor_patient_auth TO ''', @app_user, '''@''%''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := CONCAT('GRANT SELECT, INSERT, UPDATE ON `', @schema_name, '`.appointment TO ''', @app_user, '''@''%''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := CONCAT('GRANT SELECT, INSERT, UPDATE ON `', @schema_name, '`.diagnosis TO ''', @app_user, '''@''%''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := CONCAT('GRANT SELECT, INSERT, UPDATE ON `', @schema_name, '`.prescription TO ''', @app_user, '''@''%''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := CONCAT('GRANT SELECT, INSERT, UPDATE ON `', @schema_name, '`.medical_document TO ''', @app_user, '''@''%''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := CONCAT('GRANT SELECT, INSERT, UPDATE ON `', @schema_name, '`.document_request TO ''', @app_user, '''@''%''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := CONCAT('GRANT SELECT, INSERT, UPDATE ON `', @schema_name, '`.announcement TO ''', @app_user, '''@''%''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := CONCAT('GRANT SELECT, INSERT ON `', @schema_name, '`.auditlog TO ''', @app_user, '''@''%''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := CONCAT('GRANT SELECT, INSERT, UPDATE ON `', @schema_name, '`.password_reset_token TO ''', @app_user, '''@''%''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := CONCAT('GRANT SELECT, INSERT, UPDATE ON `', @schema_name, '`.email_verification_code TO ''', @app_user, '''@''%''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := CONCAT('GRANT SELECT, INSERT, UPDATE, DELETE ON `', @schema_name, '`.sessions TO ''', @app_user, '''@''%''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

FLUSH PRIVILEGES;
SQL
