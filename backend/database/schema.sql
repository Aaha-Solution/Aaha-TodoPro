-- India Nippon Electricals Limited - Todo Database Schema
CREATE DATABASE IF NOT EXISTS inel_todo;
USE inel_todo;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
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

-- Process Audit Production Requests
CREATE TABLE IF NOT EXISTS process_audit_requests (
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

-- Line Stoppers (Andon Quality Halts)
CREATE TABLE IF NOT EXISTS line_stoppers (
  id VARCHAR(30) PRIMARY KEY,
  line VARCHAR(100) NOT NULL,
  part_number VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  severity VARCHAR(30) DEFAULT 'CRITICAL',
  reason TEXT NOT NULL,
  containment TEXT NOT NULL,
  status ENUM('ACTIVE', 'RESOLVED') DEFAULT 'ACTIVE',
  triggered_by VARCHAR(100) NOT NULL,
  triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cleared_by VARCHAR(100),
  clearance_remarks TEXT,
  cleared_at TIMESTAMP NULL
);

-- IHLR (In-House Line Rejection) Analysis Reports
CREATE TABLE IF NOT EXISTS ihlr_requests (
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

