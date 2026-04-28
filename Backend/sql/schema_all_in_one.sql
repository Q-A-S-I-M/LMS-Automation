-- University AI Portal - Complete schema (single-run)
-- Run this file first, then run dummy_data.sql

CREATE DATABASE IF NOT EXISTS university_portal;
USE university_portal;

-- Students
CREATE TABLE IF NOT EXISTS students (
  roll_no VARCHAR(10) PRIMARY KEY,
  full_name VARCHAR(100),
  email VARCHAR(100) UNIQUE,
  password_hash VARCHAR(255),
  degree VARCHAR(50),
  section VARCHAR(10),
  batch VARCHAR(20),
  campus VARCHAR(50),
  dob DATE,
  cnic VARCHAR(20),
  blood_group VARCHAR(5),
  nationality VARCHAR(50),
  status ENUM('Current', 'Alumni', 'Withdrawn') DEFAULT 'Current'
);

-- Teachers (admin/instructor module)
CREATE TABLE IF NOT EXISTS teachers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Courses Catalog
CREATE TABLE IF NOT EXISTS courses (
  course_code VARCHAR(10) PRIMARY KEY,
  course_name VARCHAR(100),
  credit_hours INT
);

-- Registration cycles (typically one per semester)
CREATE TABLE IF NOT EXISTS registration_cycles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  semester VARCHAR(20) NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('Open', 'Closed') NOT NULL DEFAULT 'Open',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date >= start_date)
);

-- Courses offered in each registration cycle
CREATE TABLE IF NOT EXISTS course_offerings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  semester VARCHAR(20) NOT NULL,
  course_code VARCHAR(10) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_off_course FOREIGN KEY (course_code) REFERENCES courses(course_code),
  CONSTRAINT fk_off_cycle FOREIGN KEY (semester) REFERENCES registration_cycles(semester),
  UNIQUE KEY uq_offering (semester, course_code),
  INDEX idx_off_semester (semester),
  INDEX idx_off_course (course_code)
);

-- Course registrations (Registered -> Enrolled lock lifecycle)
CREATE TABLE IF NOT EXISTS course_registrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  roll_no VARCHAR(10) NOT NULL,
  course_code VARCHAR(10) NOT NULL,
  semester VARCHAR(20) NOT NULL,
  status ENUM('Registered', 'Enrolled', 'Dropped') NOT NULL DEFAULT 'Registered',
  enrolled_at TIMESTAMP NULL,
  dropped_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reg_student FOREIGN KEY (roll_no) REFERENCES students(roll_no),
  CONSTRAINT fk_reg_course FOREIGN KEY (course_code) REFERENCES courses(course_code),
  CONSTRAINT fk_reg_cycle FOREIGN KEY (semester) REFERENCES registration_cycles(semester),
  UNIQUE KEY uq_reg (roll_no, course_code, semester),
  INDEX idx_reg_roll_sem (roll_no, semester),
  INDEX idx_reg_course (course_code),
  INDEX idx_reg_status_sem (status, semester)
);

-- Semester-level lock once student finalizes registration
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

-- Enrollment & transcript data (final academic record)
CREATE TABLE IF NOT EXISTS enrollments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  roll_no VARCHAR(10),
  course_code VARCHAR(10),
  semester VARCHAR(20),
  grade VARCHAR(2),
  points DECIMAL(3,2),
  final_percentage DECIMAL(5,2),
  passed BOOLEAN,
  FOREIGN KEY (roll_no) REFERENCES students(roll_no),
  FOREIGN KEY (course_code) REFERENCES courses(course_code),
  UNIQUE KEY uq_enroll (roll_no, course_code, semester),
  INDEX idx_enrollments_roll_sem (roll_no, semester),
  INDEX idx_enrollments_course (course_code)
);

-- Attendance tracking (semester-aware)
CREATE TABLE IF NOT EXISTS attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  roll_no VARCHAR(10),
  course_code VARCHAR(10),
  semester VARCHAR(20),
  lecture_no INT,
  date DATE,
  duration_hours INT,
  presence ENUM('P', 'A'),
  FOREIGN KEY (roll_no) REFERENCES students(roll_no),
  UNIQUE KEY uq_att (roll_no, course_code, semester, lecture_no),
  INDEX idx_att_roll_course (roll_no, course_code),
  INDEX idx_att_roll_course_sem (roll_no, course_code, semester),
  INDEX idx_att_date (date)
);

-- Marks / assessment components (semester-aware)
CREATE TABLE IF NOT EXISTS marks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  roll_no VARCHAR(10),
  course_code VARCHAR(10),
  semester VARCHAR(20),
  category ENUM('Assignment', 'Quiz', 'Sessional-I', 'Sessional-II', 'Final'),
  item_no INT,
  obtained_marks DECIMAL(5,2),
  total_marks DECIMAL(5,2),
  weightage DECIMAL(5,2),
  FOREIGN KEY (roll_no) REFERENCES students(roll_no),
  UNIQUE KEY uq_marks (roll_no, course_code, semester, category, item_no),
  INDEX idx_marks_roll_course (roll_no, course_code),
  INDEX idx_marks_roll_course_sem (roll_no, course_code, semester)
);

-- Course feedback for registered/enrolled courses
CREATE TABLE IF NOT EXISTS course_feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  roll_no VARCHAR(10) NOT NULL,
  course_code VARCHAR(10) NOT NULL,
  semester VARCHAR(20) NOT NULL,
  rating TINYINT NOT NULL,
  comment TEXT,
  teacher_response TEXT NULL,
  responded_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT fk_fb_student FOREIGN KEY (roll_no) REFERENCES students(roll_no),
  CONSTRAINT fk_fb_course FOREIGN KEY (course_code) REFERENCES courses(course_code),
  UNIQUE KEY uq_fb (roll_no, course_code, semester),
  INDEX idx_fb_roll_sem (roll_no, semester),
  INDEX idx_fb_course_sem (course_code, semester)
);
