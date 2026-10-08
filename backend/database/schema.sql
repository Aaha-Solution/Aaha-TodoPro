-- ==============================================================================
-- India Nippon Electricals Limited (INEL)
-- Microservices Database Schema & Seed Data
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS inel_todo;
USE inel_todo;

-- Clean reset of all existing tables
DROP TABLE IF EXISTS email_logs;
DROP TABLE IF EXISTS ihlr_notifications;
DROP TABLE IF EXISTS process_audit_notifications;
DROP TABLE IF EXISTS process_audit_approvals;
DROP TABLE IF EXISTS ihlr_attachments;
DROP TABLE IF EXISTS app_attachments;
DROP TABLE IF EXISTS process_audit_attachment_files;
DROP TABLE IF EXISTS tryout_trials;
DROP TABLE IF EXISTS line_stoppers;
DROP TABLE IF EXISTS ihlr_requests;
DROP TABLE IF EXISTS process_audit_requests;
DROP TABLE IF EXISTS users;

-- ==============================================================================
-- 1. USERS TABLE
-- ==============================================================================
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id VARCHAR(50) UNIQUE NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('ADMIN', 'USER') DEFAULT 'USER',
  department VARCHAR(100) DEFAULT 'PRODUCTION',
  status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_employee_id (employee_id),
  INDEX idx_user_email (email),
  INDEX idx_user_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 2. PROCESS AUDIT PRODUCTION REQUESTS
-- ==============================================================================
CREATE TABLE process_audit_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  issue_no VARCHAR(50) NOT NULL,
  escalation_date DATE NOT NULL,
  product VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  process_operation VARCHAR(100) NOT NULL,
  shift VARCHAR(50) NOT NULL,
  issue_type VARCHAR(50) NULL,
  priority VARCHAR(50) NULL,
  issue_observation TEXT NULL,
  attachments JSON NULL,
  department VARCHAR(100) NOT NULL,
  executor VARCHAR(100) NOT NULL,
  comments TEXT NULL,
  status VARCHAR(50) DEFAULT 'Pending',
  root_cause TEXT NULL,
  corrective_action TEXT NULL,
  action_attachments JSON NULL,
  standardization_details TEXT NULL,
  target_date VARCHAR(50) NULL,
  action_taken_by VARCHAR(100) NULL,
  action_taken_at TIMESTAMP NULL,
  approved_by VARCHAR(100) NULL,
  approved_by_id INT NULL,
  approved_by_email VARCHAR(100) NULL,
  approved_at TIMESTAMP NULL,
  created_by VARCHAR(100) NULL,
  created_by_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pa_issue_no (issue_no),
  INDEX idx_pa_status (status),
  INDEX idx_pa_executor (executor)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 3. PROCESS AUDIT APPROVALS & SIGN-OFFS
-- ==============================================================================
CREATE TABLE process_audit_approvals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  issue_no VARCHAR(50) NOT NULL,
  approved_by VARCHAR(100) NOT NULL,
  approved_by_id INT NULL,
  approved_by_email VARCHAR(100) NULL,
  approved_by_role VARCHAR(50) NULL,
  department VARCHAR(100) NULL,
  executor VARCHAR(100) NULL,
  root_cause TEXT NULL,
  corrective_action TEXT NULL,
  action_attachments JSON NULL,
  standardization_details TEXT NULL,
  target_date VARCHAR(50) NULL,
  status VARCHAR(50) DEFAULT 'Approved',
  comments TEXT NULL,
  approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pa_appr_request (request_id),
  INDEX idx_pa_appr_issue (issue_no),
  INDEX idx_pa_appr_user (approved_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 4. PROCESS AUDIT NOTIFICATIONS
-- ==============================================================================
CREATE TABLE process_audit_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  user_name VARCHAR(100) NOT NULL,
  user_email VARCHAR(150) NULL,
  request_id INT NOT NULL,
  issue_no VARCHAR(50) NOT NULL,
  type VARCHAR(50) DEFAULT 'assignment',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  link VARCHAR(255) DEFAULT '/process-audit/approvals',
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pa_notif_user (user_name),
  INDEX idx_pa_notif_req (request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 5. PROCESS AUDIT BINARY ATTACHMENTS STORAGE (LONGBLOB)
-- ==============================================================================
CREATE TABLE process_audit_attachment_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL DEFAULT 'application/octet-stream',
  file_size INT NOT NULL DEFAULT 0,
  file_data LONGBLOB NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pa_att_filename (filename)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 6. IHLR (IN-HOUSE LINE REJECTION) ANALYSIS REPORTS
-- ==============================================================================
CREATE TABLE ihlr_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  req_no VARCHAR(50) NOT NULL,
  batch_date DATE NOT NULL,
  shift VARCHAR(20) NOT NULL,
  problem VARCHAR(255) NOT NULL,
  model VARCHAR(100) NOT NULL,
  problem_detected_at VARCHAR(100) NOT NULL,
  received_from VARCHAR(100) NOT NULL,
  analysis_done_by VARCHAR(100) NOT NULL,
  defect_image TEXT NULL,
  qa_why_why JSON NULL,
  actual_qty INT DEFAULT 1,
  four_m VARCHAR(50) DEFAULT 'MAN',
  resp VARCHAR(50) DEFAULT 'PRODUCTION',
  resp_person VARCHAR(100) NULL,
  prod_why_why JSON NULL,
  action TEXT NULL,
  evidence_attachment TEXT NULL,
  target_date DATE NULL,
  remarks TEXT NULL,
  status ENUM('OPEN', 'IN_PROGRESS', 'CLOSED') DEFAULT 'OPEN',
  created_by VARCHAR(100) NULL,
  created_by_id INT NULL,
  created_by_email VARCHAR(150) NULL,
  resp_person_email VARCHAR(150) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ihlr_req_no (req_no),
  INDEX idx_ihlr_resp_person (resp_person),
  INDEX idx_ihlr_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 7. IHLR IN-APP NOTIFICATIONS
-- ==============================================================================
CREATE TABLE ihlr_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  user_name VARCHAR(100) NOT NULL,
  user_email VARCHAR(150) NULL,
  request_id INT NOT NULL,
  req_no VARCHAR(50) NOT NULL,
  type VARCHAR(50) DEFAULT 'assignment',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  link VARCHAR(255) DEFAULT '/ihlr/my-requests',
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ihlr_notif_user (user_name),
  INDEX idx_ihlr_notif_req (request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 8. COMMON APP BINARY ATTACHMENTS STORAGE (LONGBLOB)
-- ==============================================================================
CREATE TABLE app_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  module_name VARCHAR(50) NOT NULL DEFAULT 'COMMON',
  ref_id INT NULL,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  file_data LONGBLOB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_app_att_mod (module_name),
  INDEX idx_app_att_ref (ref_id),
  INDEX idx_app_att_fn (filename)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 9. IHLR SPECIFIC BINARY ATTACHMENTS (LONGBLOB)
-- ==============================================================================
CREATE TABLE ihlr_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NULL,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  file_data LONGBLOB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ihlr_att_req (request_id),
  INDEX idx_ihlr_att_fn (filename)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 10. EMAIL AUDIT LOGS TABLE
-- ==============================================================================
CREATE TABLE email_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  module_type VARCHAR(50) NOT NULL,
  request_id INT NULL,
  reference_no VARCHAR(50) NULL,
  recipient_role VARCHAR(50) NOT NULL,
  recipient_name VARCHAR(100) NULL,
  recipient_email VARCHAR(150) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body_text TEXT,
  body_html LONGTEXT,
  delivery_status VARCHAR(50) DEFAULT 'SENT',
  smtp_response TEXT,
  error_message TEXT,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_ref (reference_no),
  INDEX idx_email_recipient (recipient_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- INITIAL SEED DATA
-- ==============================================================================

-- 1. Default Administrator Account (Password: admin@123)
INSERT INTO users (id, name, email, password, role, department, status) VALUES
(1, 'Admin', 'admin@gmail.com', '$2a$10$FPtxFd2HfqHQv3xiXzuj9.HmyZTpuaFZ5pmQJFleBmySa.Vdn2nxm', 'ADMIN', 'INCOMING QUALITY', 'ACTIVE')
ON DUPLICATE KEY UPDATE name = VALUES(name), password = VALUES(password);
