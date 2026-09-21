CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(120) UNIQUE NOT NULL,
  nickname VARCHAR(80) NOT NULL,
  bio TEXT,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trips (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  owner_id BIGINT NOT NULL,
  destination VARCHAR(120) NOT NULL,
  depart_date DATE NOT NULL,
  days INT NOT NULL,
  budget_min DECIMAL(10,2),
  budget_max DECIMAL(10,2),
  transport VARCHAR(40),
  companion_count INT,
  gender_preference VARCHAR(40),
  status VARCHAR(30) DEFAULT 'OPEN'
);

CREATE TABLE IF NOT EXISTS trip_days (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  trip_id BIGINT NOT NULL,
  day_no INT NOT NULL,
  title VARCHAR(160),
  lodging VARCHAR(160),
  transport_plan VARCHAR(160)
);

CREATE TABLE IF NOT EXISTS budgets (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  trip_id BIGINT NOT NULL,
  category VARCHAR(40) NOT NULL,
  planned DECIMAL(10,2) NOT NULL,
  spent DECIMAL(10,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS trip_members (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  trip_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_trip_member (trip_id, user_id)
);

CREATE TABLE IF NOT EXISTS expenses (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  trip_id BIGINT NOT NULL,
  payer_id BIGINT NOT NULL,
  receipt_no VARCHAR(64) NOT NULL,
  category VARCHAR(40) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  note VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  confirmed_by BIGINT,
  confirmed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_expense_trip_receipt (trip_id, receipt_no),
  KEY idx_expense_trip_status (trip_id, status)
);

CREATE TABLE IF NOT EXISTS settlements (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  trip_id BIGINT NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  planned_budget DECIMAL(12,2) NOT NULL DEFAULT 0,
  member_count INT NOT NULL,
  over_budget TINYINT(1) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'GENERATED',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_settlement_trip (trip_id)
);

CREATE TABLE IF NOT EXISTS settlement_shares (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  settlement_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  paid DECIMAL(12,2) NOT NULL DEFAULT 0,
  share DECIMAL(12,2) NOT NULL DEFAULT 0,
  net DECIMAL(12,2) NOT NULL DEFAULT 0,
  UNIQUE KEY uk_share_settlement_user (settlement_id, user_id)
);

CREATE TABLE IF NOT EXISTS diary_entries (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  trip_id BIGINT NOT NULL,
  title VARCHAR(160) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
