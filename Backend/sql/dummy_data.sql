-- Dummy data for University Portal (single schema version)
-- Run AFTER schema_all_in_one.sql

USE university_portal;

-- Safety patch for databases created from older schema versions:
-- ensures this table exists before TRUNCATE statements.
CREATE TABLE IF NOT EXISTS student_registration_locks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  roll_no VARCHAR(10) NOT NULL,
  semester VARCHAR(20) NOT NULL,
  finalized_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_srl_student FOREIGN KEY (roll_no) REFERENCES students(roll_no),
  CONSTRAINT fk_srl_cycle FOREIGN KEY (semester) REFERENCES registration_cycles(semester),
  UNIQUE KEY uq_srl (roll_no, semester),
  INDEX idx_srl_semester (semester)
);

-- Optional cleanup (keep ON for repeatable seeding)
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE course_feedback;
TRUNCATE TABLE student_registration_locks;
TRUNCATE TABLE course_registrations;
TRUNCATE TABLE marks;
TRUNCATE TABLE attendance;
TRUNCATE TABLE enrollments;
TRUNCATE TABLE course_offerings;
TRUNCATE TABLE registration_cycles;
TRUNCATE TABLE teachers;
TRUNCATE TABLE courses;
TRUNCATE TABLE students;
SET FOREIGN_KEY_CHECKS = 1;

-- Courses
INSERT INTO courses (course_code, course_name, credit_hours) VALUES
('CS101', 'Programming Fundamentals', 3),
('CS102', 'Object Oriented Programming', 3),
('CS201', 'Data Structures', 3),
('MT101', 'Calculus I', 3),
('EN101', 'Functional English', 2);

-- Teachers
-- teacher1 / teacher123
-- minhal_raza / abc123
INSERT INTO teachers (username, email, password_hash, full_name) VALUES
('teacher1', 'teacher1@university.edu', '$2b$10$e0NRwJ4n9mAr8M4J6zG4fOjSeyzSx8Qz10P9NSh0hM8z4A0SxPKXi', 'Dr. Ahmed Farooq'),
('minhal_raza', 'minhal.raza@university.edu', '$2b$10$ioNIW5BBWeY5r.cR1e/0Me/M93E14eWTaa9Ivsa3w3cDoKOYNlfo2', 'Minhal Raza');

-- Students
-- 20CS001 / student123
-- 20CS002 / pass1234
-- 21CS015 / demo1234
INSERT INTO students
(roll_no, full_name, email, password_hash, degree, section, batch, campus, dob, cnic, blood_group, nationality, status)
VALUES
('20CS001','Ali Raza','ali.raza@example.com','$2b$10$cV/wtS7Y/LF/SHSCMJBq8.4TXqj.BEpV1RL7NJAqYacyRJ5IU2vd.','BSCS','A','2020','Main','2002-01-15','35202-1234567-1','B+','Pakistani','Current'),
('20CS002','Ayesha Khan','ayesha.khan@example.com','$2b$10$FhBpX6fdY8vZ6aruallR9u7ZYHBTFTSaSeovVFQd2E65bSHoKsclm','BSCS','A','2020','Main','2002-05-03','35202-9876543-2','O+','Pakistani','Current'),
('21CS015','Hassan Ali','hassan.ali@example.com','$2b$10$dwjUuxVkgido/A4vxffxbuxr1m3oB6Mp1nP.n8GOn5W1GQqPrBBDG','BSCS','B','2021','City','2003-11-21','35201-5554443-9','A+','Pakistani','Current');

-- Registration cycles (4-month windows)
INSERT INTO registration_cycles (semester, start_date, end_date, status) VALUES
('Fall-2025',   '2025-08-01', '2025-11-30', 'Closed'),
('Spring-2026', '2026-01-01', '2026-04-30', 'Open'),
('Fall-2026',   '2026-08-01', '2026-11-30', 'Open');

-- Course offerings by semester
INSERT INTO course_offerings (semester, course_code, is_active) VALUES
('Fall-2025',   'CS101', 1),
('Fall-2025',   'MT101', 1),
('Fall-2025',   'EN101', 1),
('Spring-2026', 'CS101', 1),
('Spring-2026', 'CS102', 1),
('Spring-2026', 'CS201', 1),
('Spring-2026', 'MT101', 1),
('Spring-2026', 'EN101', 1),
('Fall-2026',   'CS102', 1),
('Fall-2026',   'CS201', 1),
('Fall-2026',   'MT101', 1);

-- Historical enrollments (transcript)
-- Includes one fail case (20CS002 MT101 = 48%, failed) for re-registration behavior.
INSERT INTO enrollments (roll_no, course_code, semester, grade, points, final_percentage, passed) VALUES
('20CS001','CS101','Fall-2024','A', 4.00,86.00,1),
('20CS001','MT101','Fall-2024','B+',3.33,76.00,1),
('20CS001','EN101','Fall-2024','A-',3.67,82.00,1),
('20CS001','CS102','Spring-2025','B', 3.00,73.00,1),
('20CS001','CS201','Spring-2025','A', 4.00,88.00,1),

('20CS002','CS101','Fall-2024','B', 3.00,71.00,1),
('20CS002','MT101','Fall-2024','D', 1.00,48.00,0),
('20CS002','EN101','Fall-2024','A', 4.00,85.00,1),
('20CS002','CS102','Spring-2025','B+',3.33,77.00,1),
('20CS002','CS201','Spring-2025','B', 3.00,74.00,1),

('21CS015','CS101','Fall-2025','A', 4.00,87.00,1),
('21CS015','MT101','Fall-2025','B', 3.00,72.00,1),
('21CS015','EN101','Fall-2025','B-',2.67,67.00,1);

-- Attendance samples
INSERT INTO attendance (roll_no, course_code, semester, lecture_no, date, duration_hours, presence) VALUES
('20CS001','CS101','Fall-2024',1,'2024-09-02',1,'P'),
('20CS001','CS101','Fall-2024',2,'2024-09-04',1,'P'),
('20CS001','CS101','Fall-2024',3,'2024-09-06',1,'A'),
('20CS001','CS101','Fall-2024',4,'2024-09-09',1,'P'),
('20CS001','CS101','Fall-2024',5,'2024-09-11',1,'P'),
('20CS001','CS201','Spring-2025',1,'2025-02-03',2,'P'),
('20CS001','CS201','Spring-2025',2,'2025-02-05',2,'P'),
('20CS001','CS201','Spring-2025',3,'2025-02-10',2,'P'),
('20CS001','CS201','Spring-2025',4,'2025-02-12',2,'A');

-- Marks samples
INSERT INTO marks (roll_no, course_code, semester, category, item_no, obtained_marks, total_marks, weightage) VALUES
('20CS001','CS101','Fall-2024','Assignment',1,8,10,5),
('20CS001','CS101','Fall-2024','Assignment',2,9,10,5),
('20CS001','CS101','Fall-2024','Quiz',1,7,10,5),
('20CS001','CS101','Fall-2024','Quiz',2,9,10,5),
('20CS001','CS101','Fall-2024','Sessional-I',1,18,25,15),
('20CS001','CS101','Fall-2024','Sessional-II',1,20,25,15),
('20CS001','CS101','Fall-2024','Final',1,45,60,50),
('20CS001','CS201','Spring-2025','Assignment',1,10,10,5),
('20CS001','CS201','Spring-2025','Quiz',1,9,10,5),
('20CS001','CS201','Spring-2025','Sessional-I',1,21,25,15),
('20CS001','CS201','Spring-2025','Sessional-II',1,22,25,15),
('20CS001','CS201','Spring-2025','Final',1,52,60,50);

-- Current registration state for Spring-2026:
-- 20CS001: open (not finalized), can still add/drop
INSERT INTO course_registrations (roll_no, course_code, semester, status, enrolled_at) VALUES
('20CS001','CS101','Spring-2026','Registered',NULL),
('20CS001','MT101','Spring-2026','Registered',NULL);

-- 20CS002: finalized semester (locked), all selected courses enrolled
INSERT INTO course_registrations (roll_no, course_code, semester, status, enrolled_at) VALUES
('20CS002','CS102','Spring-2026','Enrolled',CURRENT_TIMESTAMP),
('20CS002','MT101','Spring-2026','Enrolled',CURRENT_TIMESTAMP);

INSERT INTO enrollments (roll_no, course_code, semester, grade, points, final_percentage, passed) VALUES
('20CS002','CS102','Spring-2026',NULL,NULL,NULL,NULL),
('20CS002','MT101','Spring-2026',NULL,NULL,NULL,NULL);

INSERT INTO student_registration_locks (roll_no, semester, finalized_at) VALUES
('20CS002','Spring-2026',CURRENT_TIMESTAMP);

-- Feedback samples
INSERT INTO course_feedback (roll_no, course_code, semester, rating, comment, teacher_response) VALUES
('20CS001','CS101','Spring-2026',5,'Great course, labs were very helpful.',NULL),
('20CS002','MT101','Spring-2026',4,'Good pace but would like more practice problems.','Thanks for the feedback. We will add more problem-solving sessions.');

