-- Seed data for India Nippon Electricals Limited Todo
USE inel_todo;

-- Users Table Seed
DELETE FROM users;
INSERT INTO users (id, name, email, password, role, department, status) VALUES
(1, 'Admin', 'admin@gmail.com', '$2a$10$eKddPnYXFMug3mqTwNdkHeoi6hy2DJ3SwaI1TodOnWMHjyTajPuiu', 'ADMIN', 'PRODUCTION', 'ACTIVE'),
(2, 'iyyu', 'iyyu@gmail.com', '$2a$10$ov9zjIK.JNbfwBDBMXwtsOS5M1DC05dqY9mPD5LtRFJy5bjx5zuvC', 'ADMIN', 'INCOMING QUALITY', 'ACTIVE')
ON DUPLICATE KEY UPDATE name=VALUES(name), password=VALUES(password), role=VALUES(role), department=VALUES(department);

-- Optional: Sample IHLR requests commented out so req_no starts cleanly from IHLR-1
-- If sample records are needed, uncomment below:
-- INSERT INTO ihlr_requests (id, req_no, batch_date, shift, problem, model, problem_detected_at, received_from, analysis_done_by, defect_image, qa_why_why, actual_qty, four_m, resp, resp_person, prod_why_why, action, evidence_attachment, target_date, remarks, status) VALUES
-- (1, 'IHLR-1', '2026-09-01', 'I', 'Low voltage', 'OLS LONG ARM', 'Final Testing', 'D3/LINE', 'GURU', '', '["Low voltage", "Sensor improper soldering", "Skipped visual inspection", "", ""]', 1, 'MAN', 'PRODUCTION', 'Mr. Kumar (Assembly Lead)', '["Operator fatigue during shift end", "", "", "", ""]', 'Provide supplementary station LED lighting & retrain solder visual inspection check', '', '2026-09-15', 'Critical containment completed', 'OPEN');


