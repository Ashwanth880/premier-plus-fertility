CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(320) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(160) NOT NULL,
  role ENUM('admin', 'staff') NOT NULL DEFAULT 'staff',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS branches (
  id CHAR(36) NOT NULL PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS patients (
  id CHAR(36) NOT NULL PRIMARY KEY,
  patient_id VARCHAR(32) NOT NULL UNIQUE,
  title VARCHAR(16) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  full_name VARCHAR(220) NOT NULL,
  age TINYINT UNSIGNED NOT NULL,
  date_of_birth DATE NOT NULL,
  gender VARCHAR(32) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  normalized_phone VARCHAR(32) NOT NULL UNIQUE,
  branch_id CHAR(36) NOT NULL,
  purpose VARCHAR(160) NOT NULL,
  referral_source VARCHAR(160) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_patients_branch FOREIGN KEY (branch_id) REFERENCES branches(id)
);

CREATE TABLE IF NOT EXISTS appointments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  patient_id CHAR(36) NOT NULL,
  branch_id CHAR(36) NOT NULL,
  doctor_id CHAR(36) NULL,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  type VARCHAR(64) NOT NULL,
  reason VARCHAR(1000) NOT NULL,
  status ENUM('scheduled', 'checked_in', 'completed', 'cancelled') NOT NULL DEFAULT 'scheduled',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_appointments_patient FOREIGN KEY (patient_id) REFERENCES patients(id),
  CONSTRAINT fk_appointments_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
  INDEX idx_appointments_branch_date (branch_id, appointment_date),
  INDEX idx_appointments_patient (patient_id)
);

CREATE TABLE IF NOT EXISTS appointment_slot_locks (
  branch_id CHAR(36) NOT NULL,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  appointment_id CHAR(36) NULL,
  PRIMARY KEY (branch_id, appointment_date, start_time),
  CONSTRAINT fk_slot_locks_branch FOREIGN KEY (branch_id) REFERENCES branches(id)
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  operation VARCHAR(64) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  response_status SMALLINT NOT NULL,
  response_body JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3) NOT NULL,
  UNIQUE KEY uq_idempotency_operation_key (operation, idempotency_key)
);

CREATE TABLE IF NOT EXISTS appointment_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  appointment_id CHAR(36) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  actor_user_id CHAR(36) NULL,
  metadata JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_events_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id),
  CONSTRAINT fk_events_actor FOREIGN KEY (actor_user_id) REFERENCES users(id)
);

INSERT INTO branches (id, code, name, timezone)
VALUES ('00000000-0000-0000-0000-000000000001', 'KODAMBAKKAM', 'Kodambakkam', 'Asia/Kolkata')
ON DUPLICATE KEY UPDATE name = VALUES(name), timezone = VALUES(timezone);
