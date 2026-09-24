-- India Nippon Electricals Limited - Todo Database Schema & Initial Data
CREATE DATABASE IF NOT EXISTS inel_todo;
USE inel_todo;

-- Drop existing tables to allow a clean reset
DROP TABLE IF EXISTS email_logs;
DROP TABLE IF EXISTS ihlr_notifications;
DROP TABLE IF EXISTS process_audit_notifications;
DROP TABLE IF EXISTS process_audit_approvals;
DROP TABLE IF EXISTS ihlr_attachments;
DROP TABLE IF EXISTS app_attachments;
DROP TABLE IF EXISTS process_audit_attachment_files;
DROP TABLE IF EXISTS line_stoppers;
DROP TABLE IF EXISTS ihlr_requests;
DROP TABLE IF EXISTS process_audit_requests;
DROP TABLE IF EXISTS users;

-- 1. Users Table
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('ADMIN', 'USER') DEFAULT 'USER',
  department VARCHAR(100) DEFAULT 'PRODUCTION',
  status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Process Audit Production Requests
CREATE TABLE process_audit_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  issue_no VARCHAR(50) NOT NULL,
  escalation_date DATE NOT NULL,
  product VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  process_operation VARCHAR(100) NOT NULL,
  shift VARCHAR(50) NOT NULL,
  issue_type VARCHAR(50),
  priority VARCHAR(50),
  issue_observation TEXT,
  attachments JSON,
  department VARCHAR(100) NOT NULL,
  executor VARCHAR(100) NOT NULL,
  comments TEXT,
  status VARCHAR(50) DEFAULT 'Pending Execution',
  created_by VARCHAR(100),
  created_by_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. Process Audit Approvals & Sign-offs
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
  INDEX idx_request_id (request_id),
  INDEX idx_issue_no (issue_no),
  INDEX idx_approved_by (approved_by)
);

-- 4. Process Audit Notifications
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
  INDEX idx_user_name (user_name),
  INDEX idx_req_id (request_id)
);

-- 5. IHLR (In-House Line Rejection) Analysis Reports
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
  defect_image TEXT,
  qa_why_why JSON,
  actual_qty INT DEFAULT 1,
  four_m VARCHAR(50) DEFAULT 'MAN',
  resp VARCHAR(50) DEFAULT 'PRODUCTION',
  resp_person VARCHAR(100),
  prod_why_why JSON,
  action TEXT,
  evidence_attachment TEXT,
  target_date DATE,
  remarks TEXT,
  status ENUM('OPEN', 'IN_PROGRESS', 'CLOSED') DEFAULT 'OPEN',
  created_by VARCHAR(100) NULL,
  created_by_id INT NULL,
  created_by_email VARCHAR(150) NULL,
  resp_person_email VARCHAR(150) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_req_no (req_no),
  INDEX idx_resp_person (resp_person)
);

-- 6. IHLR In-App Notifications (Dual alerts: raised person & assigned person)
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
);

-- 7. Common App Binary File Attachments Storage (LONGBLOB)
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
  INDEX idx_mod (module_name),
  INDEX idx_ref (ref_id),
  INDEX idx_fn (filename)
);

-- 8. IHLR Specific Binary Attachments (backward compatibility)
CREATE TABLE ihlr_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NULL,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  file_data LONGBLOB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_req (request_id),
  INDEX idx_fn (filename)
);

-- 9. Email Audit Logs Table
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
);

-- ============================================================================
-- INITIAL SEED DATA (Default Admin Only)
-- ============================================================================

INSERT INTO users (id, name, email, password, role, department, status) VALUES
(1, 'Admin', 'admin@gmail.com', '$2a$10$CrwtyoMRR8nc7T9QGIok1Okp6GtY07069ME0c0kvvrpMu7NzsSKR6', 'ADMIN', 'INCOMING QUALITY', 'ACTIVE');
