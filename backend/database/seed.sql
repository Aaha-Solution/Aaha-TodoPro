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
