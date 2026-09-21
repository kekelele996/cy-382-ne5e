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
  budget_min DECIMAL(12,2),
  budget_max DECIMAL(12,2),
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

-- 行程成员：发布行程时发布者自动入组，其他成员申请加入。
CREATE TABLE IF NOT EXISTS trip_members (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  trip_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_trip_member (trip_id, user_id)
);

-- 分品类计划预算（交通/住宿/餐饮/门票等），用于清算超支判定。
CREATE TABLE IF NOT EXISTS budgets (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  trip_id BIGINT NOT NULL,
  category VARCHAR(40) NOT NULL,
  planned DECIMAL(12,2) NOT NULL,
  UNIQUE KEY uk_budget_trip_category (trip_id, category)
);

-- 垫付支出：同行程同票据号唯一；状态待确认/已确认/已驳回/已冻结。
CREATE TABLE IF NOT EXISTS expenses (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  trip_id BIGINT NOT NULL,
  payer_id BIGINT NOT NULL,
  receipt_no VARCHAR(80) NOT NULL,
  title VARCHAR(160) NOT NULL,
  category VARCHAR(40) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  confirmed_by BIGINT NULL,
  rejected_by BIGINT NULL,
  reject_reason VARCHAR(255) NULL,
  frozen_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_expense_receipt (trip_id, receipt_no)
);

-- 清算单：每行程至多一份，生成即冻结，记录超支标记与零和净额校验值。
CREATE TABLE IF NOT EXISTS settlements (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  trip_id BIGINT NOT NULL,
  created_by BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'SETTLED',
  total_amount DECIMAL(12,2) NOT NULL,
  per_person DECIMAL(12,2) NOT NULL,
  net_sum DECIMAL(12,2) NOT NULL,
  over_budget TINYINT(1) NOT NULL DEFAULT 0,
  over_budget_detail JSON NULL,
  member_count INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_settlement_trip (trip_id)
);

-- 清算单成员明细：net = paid - share，全员净额之和为 0。
CREATE TABLE IF NOT EXISTS settlement_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  settlement_id BIGINT NOT NULL,
  trip_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  paid DECIMAL(12,2) NOT NULL,
  share DECIMAL(12,2) NOT NULL,
  net DECIMAL(12,2) NOT NULL,
  UNIQUE KEY uk_settlement_item (settlement_id, user_id)
);

CREATE TABLE IF NOT EXISTS diary_entries (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  trip_id BIGINT NOT NULL,
  title VARCHAR(160) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
