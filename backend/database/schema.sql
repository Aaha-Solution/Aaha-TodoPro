-- India Nippon Electricals Limited - Todo Database Schema
CREATE DATABASE IF NOT EXISTS inel_todo;
USE inel_todo;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'CREATOR',
  department VARCHAR(100) DEFAULT 'Quality Assurance',
  status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Process Audit Production Requests
CREATE TABLE IF NOT EXISTS process_audit_requests (
  id VARCHAR(30) PRIMARY KEY,
  batch_date DATE NOT NULL,
  shift VARCHAR(50) NOT NULL,
  priority VARCHAR(20) DEFAULT 'High',
  quantity VARCHAR(50) NOT NULL,
  unit VARCHAR(20) DEFAULT 'Units',
  stage VARCHAR(50) NOT NULL,
  line VARCHAR(100) NOT NULL,
  creator VARCHAR(100) NOT NULL,
  executor VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'Pending Execution',
  comments TEXT,
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
