-- Seed data for India Nippon Electricals Limited Todo
USE inel_todo;

-- Users Table Seed
DELETE FROM users;
INSERT INTO users (id, name, email, password, role, department, status) VALUES
(1, 'Admin', 'admin@gmail.com', '$2a$10$eKddPnYXFMug3mqTwNdkHeoi6hy2DJ3SwaI1TodOnWMHjyTajPuiu', 'ADMIN', 'Management', 'ACTIVE'),
(2, 'iyyu', 'iyyu@gmail.com', '$2a$10$l2B52WTglCm4T8WphVzBiO1JEMdOB32J1uqkf/6pQEujglIpdZZWC', 'ADMIN', 'Quality Assurance', 'ACTIVE')
ON DUPLICATE KEY UPDATE name=VALUES(name), password=VALUES(password), role=VALUES(role);

INSERT INTO process_audit_requests (id, batch_date, shift, priority, quantity, unit, stage, line, creator, executor, status, comments) VALUES
('REQ-1001', '2026-09-03', 'Morning', 'High', '1,250', 'Units', 'Assembly', 'Line A - Main Chassis Assembly', 'iyyu', 'Mr. Kumar', 'Pending Execution', 'Target completion by end of shift.'),
('REQ-1002', '2026-09-03', 'Evening', 'High', '980', 'Units', 'Inspection', 'Line C - Optical Inspection', 'iyyu', 'Mr. Ravi', 'Pending Approval', 'Special optical inspection for lead coplanarity.'),
('REQ-1003', '2026-09-02', 'Afternoon', 'Medium', '3,400', 'Units', 'Packaging', 'Line D - High Speed Pack', 'iyyu', 'Mr. Arjun', 'Partially Approved', 'Lot label printing verified.'),
('REQ-1004', '2026-09-01', 'Morning', 'Low', '2,500', 'Kg', 'Raw Material', 'Raw Material Intake Silo 3', 'iyyu', 'Mr. Suresh', 'Approved', 'Moisture content tested: 0.02%.'),
('REQ-1005', '2026-09-02', 'Night', 'Critical', '2,100', 'Units', 'Production', 'Line B - CNC Milling', 'iyyu', 'Mr. Suresh', 'Rejected', 'Excessive tool chatter observed.')
ON DUPLICATE KEY UPDATE status=VALUES(status);

-- IHLR Requests Seed
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
  resp VARCHAR(50) DEFAULT 'PROD',
  prod_why_why JSON,
  action TEXT,
  evidence_attachment TEXT,
  target_date DATE,
  remarks TEXT,
  status ENUM('OPEN', 'IN_PROGRESS', 'CLOSED') DEFAULT 'OPEN',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO ihlr_requests (id, req_no, batch_date, shift, problem, model, problem_detected_at, received_from, analysis_done_by, defect_image, qa_why_why, actual_qty, four_m, resp, prod_why_why, action, evidence_attachment, target_date, remarks, status) VALUES
(1, '1', '2026-09-01', 'I', 'Low voltage', 'OLS LONG ARM', 'Final Testing', 'D3/LINE', 'GURU', 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=60', '["Low voltage", "Sensor improper soldering", "Skipped visual inspection", "", ""]', 1, 'MAN', 'PROD', '["Operator fatigue during shift end", "Illumination level below 300 Lux at station", "", "", ""]', 'Provide supplementary station LED lighting & retrain solder visual inspection check', 'IHLR_Action_Evid_001.pdf', '2026-09-15', 'Critical customer delivery batch containment completed', 'OPEN'),
(2, '2', '2026-09-02', 'II', 'Flash / Burr excess on housing', 'CDI CAP HOUSING', 'Visual Inspection', 'MOLDING-02', 'iyyu', 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500&auto=format&fit=crop&q=60', '["Burr on mating collar", "Tool parting line wear", "Exceeded shot life limit without polishing", "", ""]', 5, 'MACHINE', 'MAINT', '["Core pin hydraulic drift", "Seals degraded", "", "", ""]', 'Replaced hydraulic cylinder seals and repolished tool parting line edges', 'Tooling_Inspection_Report.pdf', '2026-09-18', 'Tooling PM cycle updated from 50k to 35k shots', 'IN_PROGRESS'),
(3, '3', '2026-09-03', 'I', 'Resistance out of specification (High)', 'STATOR COIL 35W', 'Electrical Testing', 'WINDING-01', 'GURU', 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=500&auto=format&fit=crop&q=60', '["Resistance > 1.8 Ohms", "Tensioner wire stretching during winding", "Brake pad worn out", "", ""]', 3, 'METHOD', 'PROD', '["Tension gauge calibration overdue", "", "", "", ""]', 'Recalibrated digital tensioner and replaced mechanical friction felt pad', 'Calibration_Cert_Sept26.pdf', '2026-09-10', 'First piece sample verified and approved by Quality Lead', 'CLOSED')
ON DUPLICATE KEY UPDATE problem=VALUES(problem), status=VALUES(status);

