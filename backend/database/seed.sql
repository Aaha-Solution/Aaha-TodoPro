-- Seed data for India Nippon Electricals Limited Todo
USE inel_todo;

-- Users Table Seed
DELETE FROM users;
INSERT INTO users (id, name, email, password, role, department, status) VALUES
(1, 'Admin', 'admin@gmail.com', '$2a$10$eKddPnYXFMug3mqTwNdkHeoi6hy2DJ3SwaI1TodOnWMHjyTajPuiu', 'ADMIN', 'PRODUCTION', 'ACTIVE'),
(2, 'iyyu', 'iyyu@gmail.com', '$2a$10$ov9zjIK.JNbfwBDBMXwtsOS5M1DC05dqY9mPD5LtRFJy5bjx5zuvC', 'ADMIN', 'INCOMING QUALITY', 'ACTIVE'),
(3, 'Karthik', 'karthik@gmail.com', '$2a$10$eKddPnYXFMug3mqTwNdkHeoi6hy2DJ3SwaI1TodOnWMHjyTajPuiu', 'USER', 'MAINTENANCE', 'ACTIVE'),
(4, 'Rajesh', 'rajesh@gmail.com', '$2a$10$eKddPnYXFMug3mqTwNdkHeoi6hy2DJ3SwaI1TodOnWMHjyTajPuiu', 'USER', 'MAINTENANCE', 'ACTIVE'),
(5, 'Balaji', 'balaji@gmail.com', '$2a$10$eKddPnYXFMug3mqTwNdkHeoi6hy2DJ3SwaI1TodOnWMHjyTajPuiu', 'USER', 'MAINTENANCE', 'ACTIVE'),
(6, 'Kumar', 'kumar@gmail.com', '$2a$10$eKddPnYXFMug3mqTwNdkHeoi6hy2DJ3SwaI1TodOnWMHjyTajPuiu', 'USER', 'PRODUCTION', 'ACTIVE'),
(7, 'Murugan', 'murugan@gmail.com', '$2a$10$eKddPnYXFMug3mqTwNdkHeoi6hy2DJ3SwaI1TodOnWMHjyTajPuiu', 'USER', 'PRODUCTION', 'ACTIVE'),
(8, 'Vignesh', 'vignesh@gmail.com', '$2a$10$eKddPnYXFMug3mqTwNdkHeoi6hy2DJ3SwaI1TodOnWMHjyTajPuiu', 'USER', 'PED', 'ACTIVE'),
(9, 'Anand', 'anand@gmail.com', '$2a$10$eKddPnYXFMug3mqTwNdkHeoi6hy2DJ3SwaI1TodOnWMHjyTajPuiu', 'USER', 'PED', 'ACTIVE'),
(10, 'Arjun', 'arjun@gmail.com', '$2a$10$eKddPnYXFMug3mqTwNdkHeoi6hy2DJ3SwaI1TodOnWMHjyTajPuiu', 'USER', 'MATERIALS', 'ACTIVE'),
(11, 'Ramesh', 'ramesh@gmail.com', '$2a$10$eKddPnYXFMug3mqTwNdkHeoi6hy2DJ3SwaI1TodOnWMHjyTajPuiu', 'USER', 'MATERIALS', 'ACTIVE'),
(12, 'Praveen', 'praveen@gmail.com', '$2a$10$eKddPnYXFMug3mqTwNdkHeoi6hy2DJ3SwaI1TodOnWMHjyTajPuiu', 'USER', 'MARKETING', 'ACTIVE'),
(13, 'Priya', 'priya@gmail.com', '$2a$10$eKddPnYXFMug3mqTwNdkHeoi6hy2DJ3SwaI1TodOnWMHjyTajPuiu', 'USER', 'MARKETING', 'ACTIVE'),
(14, 'Ravi', 'ravi@gmail.com', '$2a$10$eKddPnYXFMug3mqTwNdkHeoi6hy2DJ3SwaI1TodOnWMHjyTajPuiu', 'USER', 'INCOMING QUALITY', 'ACTIVE'),
(15, 'Prakash', 'prakash@gmail.com', '$2a$10$eKddPnYXFMug3mqTwNdkHeoi6hy2DJ3SwaI1TodOnWMHjyTajPuiu', 'USER', 'INCOMING QUALITY', 'ACTIVE')
ON DUPLICATE KEY UPDATE name=VALUES(name), password=VALUES(password), role=VALUES(role), department=VALUES(department), status=VALUES(status);

