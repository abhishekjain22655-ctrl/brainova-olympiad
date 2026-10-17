-- =====================================================================
-- BRAINOVA NATIONAL OLYMPIAD - PRODUCTION DATABASE SCHEMA (MySQL / MariaDB)
-- Detected Platform Architecture: CodeIgniter 4 / LiteSpeed / MySQL Stack
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `brainova_olympiad` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE `brainova_olympiad`;

-- ---------------------------------------------------------------------
-- 1. SCHOOLS / TENANTS TABLE
-- Multi-tenant isolation anchor for institutional accounts
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `schools` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `school_code` VARCHAR(30) NOT NULL UNIQUE,
  `school_name` VARCHAR(255) NOT NULL,
  `affiliation_board` VARCHAR(50) NOT NULL DEFAULT 'CBSE', -- CBSE, ICSE, State, IB, Cambridge
  `contact_person` VARCHAR(150) NOT NULL,
  `contact_email` VARCHAR(150) NOT NULL UNIQUE,
  `contact_phone` VARCHAR(20) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `city` VARCHAR(100) NOT NULL,
  `district` VARCHAR(100) DEFAULT NULL,
  `state` VARCHAR(100) NOT NULL,
  `pincode` VARCHAR(10) NOT NULL,
  `status` ENUM('active', 'pending', 'suspended') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_school_city` (`city`),
  INDEX `idx_school_state` (`state`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 2. STUDENTS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `students` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `roll_number` VARCHAR(50) NOT NULL UNIQUE,
  `full_name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `dob` DATE DEFAULT NULL,
  `school_id` INT DEFAULT NULL,
  `grade_class` VARCHAR(20) NOT NULL, -- e.g. Class 1 through Class 12
  `parent_name` VARCHAR(150) DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `city` VARCHAR(100) DEFAULT NULL,
  `state` VARCHAR(100) DEFAULT NULL,
  `pincode` VARCHAR(10) DEFAULT NULL,
  `status` ENUM('active', 'pending', 'suspended') DEFAULT 'active',
  `last_login` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_student_school` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE SET NULL,
  INDEX `idx_student_grade` (`grade_class`),
  INDEX `idx_student_school` (`school_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 3. SUBJECTS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `subjects` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `slug` VARCHAR(50) NOT NULL UNIQUE,
  `title` VARCHAR(100) NOT NULL,
  `description` TEXT,
  `duration_minutes` INT NOT NULL DEFAULT 30,
  `total_questions` INT NOT NULL DEFAULT 15,
  `marks_per_question` INT NOT NULL DEFAULT 4,
  `negative_marks` DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  `icon_class` VARCHAR(50) DEFAULT 'fa-book',
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 4. EXAM QUESTIONS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `exam_questions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `subject_id` INT NOT NULL,
  `class_group` VARCHAR(30) NOT NULL DEFAULT 'All', -- Primary (1-5), Middle (6-8), Senior (9-12)
  `question_text` TEXT NOT NULL,
  `option_a` TEXT NOT NULL,
  `option_b` TEXT NOT NULL,
  `option_c` TEXT NOT NULL,
  `option_d` TEXT NOT NULL,
  `correct_option` ENUM('A', 'B', 'C', 'D') NOT NULL,
  `explanation` TEXT,
  `difficulty` ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
  CONSTRAINT `fk_question_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE CASCADE,
  INDEX `idx_question_subject_group` (`subject_id`, `class_group`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 5. EXAM ATTEMPTS & SCORE TRACKER
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `exam_attempts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `student_id` INT NOT NULL,
  `school_id` INT DEFAULT NULL,
  `subject_id` INT NOT NULL,
  `total_questions` INT NOT NULL,
  `answered_count` INT NOT NULL DEFAULT 0,
  `correct_count` INT NOT NULL DEFAULT 0,
  `wrong_count` INT NOT NULL DEFAULT 0,
  `score` INT NOT NULL DEFAULT 0,
  `max_score` INT NOT NULL DEFAULT 60,
  `percentage` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `time_taken_seconds` INT NOT NULL DEFAULT 0,
  `status` ENUM('completed', 'abandoned', 'in_progress') DEFAULT 'completed',
  `attempted_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_attempt_student` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_attempt_school` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_attempt_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE CASCADE,
  INDEX `idx_attempt_student` (`student_id`),
  INDEX `idx_attempt_school` (`school_id`),
  INDEX `idx_attempt_subject` (`subject_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 6. CONTACT INQUIRIES & QUOTE REQUESTS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `contact_inquiries` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `full_name` VARCHAR(150) NOT NULL,
  `phone_number` VARCHAR(25) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `message` TEXT NOT NULL,
  `inquiry_type` VARCHAR(50) DEFAULT 'quote_request',
  `status` ENUM('new', 'in_progress', 'resolved') DEFAULT 'new',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 7. NEWSLETTER SUBSCRIPTIONS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `newsletter_subscribers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `subscribed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
