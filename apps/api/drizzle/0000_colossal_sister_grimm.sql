CREATE TABLE `departments` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `departments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employee_binding_codes` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`employee_id` bigint unsigned NOT NULL,
	`code_hash` varchar(255) NOT NULL,
	`status` enum('active','used','expired') NOT NULL DEFAULT 'active',
	`expires_at` datetime,
	`used_at` datetime,
	`created_by` bigint unsigned NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `employee_binding_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`department_id` bigint unsigned NOT NULL,
	`employee_no` varchar(20) NOT NULL,
	`name` varchar(20) NOT NULL,
	`title` varchar(50),
	`phone` varchar(20) NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `employees_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_employees_dept_no` UNIQUE(`department_id`,`employee_no`)
);
--> statement-breakpoint
CREATE TABLE `schedule_change_logs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`period_id` bigint unsigned NOT NULL,
	`operator_id` bigint unsigned NOT NULL,
	`action` varchar(32) NOT NULL,
	`detail` json,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `schedule_change_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `schedule_entries` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`period_id` bigint unsigned NOT NULL,
	`employee_id` bigint unsigned NOT NULL,
	`work_date` date NOT NULL,
	`shift_type_id` bigint unsigned NOT NULL,
	`note` varchar(255),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `schedule_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_entries_period_emp_date` UNIQUE(`period_id`,`employee_id`,`work_date`)
);
--> statement-breakpoint
CREATE TABLE `schedule_periods` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`department_id` bigint unsigned NOT NULL,
	`week_start` date NOT NULL,
	`edit_status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`has_unpublished_changes` boolean NOT NULL DEFAULT false,
	`latest_published_version` int unsigned,
	`last_published_at` datetime,
	`last_published_by` bigint unsigned,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `schedule_periods_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_periods_dept_week` UNIQUE(`department_id`,`week_start`)
);
--> statement-breakpoint
CREATE TABLE `schedule_publish_snapshots` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`period_id` bigint unsigned NOT NULL,
	`version` int unsigned NOT NULL,
	`snapshot_data` json NOT NULL,
	`published_at` datetime NOT NULL,
	`published_by` bigint unsigned NOT NULL,
	CONSTRAINT `schedule_publish_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_snapshots_period_version` UNIQUE(`period_id`,`version`)
);
--> statement-breakpoint
CREATE TABLE `shift_types` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`department_id` bigint unsigned NOT NULL,
	`code` varchar(10) NOT NULL,
	`name` varchar(50) NOT NULL,
	`start_time` time,
	`duration_minutes` int unsigned,
	`color` varchar(20) NOT NULL,
	`min_required_count` int unsigned NOT NULL DEFAULT 0,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `shift_types_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_shift_types_dept_code` UNIQUE(`department_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `swap_requests` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `swap_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`phone` varchar(20),
	`password_hash` varchar(255),
	`role` enum('admin','staff') NOT NULL,
	`employee_id` bigint unsigned,
	`wx_openid` varchar(64),
	`status` enum('active','disabled') NOT NULL DEFAULT 'active',
	`token_valid_after` datetime NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_users_phone` UNIQUE(`phone`),
	CONSTRAINT `uk_users_wx_openid` UNIQUE(`wx_openid`),
	CONSTRAINT `uk_users_employee_id` UNIQUE(`employee_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_binding_employee_status` ON `employee_binding_codes` (`employee_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_employees_dept_status` ON `employees` (`department_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_change_logs_period` ON `schedule_change_logs` (`period_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_entries_period_date` ON `schedule_entries` (`period_id`,`work_date`);--> statement-breakpoint
CREATE INDEX `idx_entries_period_shift` ON `schedule_entries` (`period_id`,`shift_type_id`,`work_date`);--> statement-breakpoint
CREATE INDEX `idx_periods_dept_week` ON `schedule_periods` (`department_id`,`week_start`);--> statement-breakpoint
CREATE INDEX `idx_snapshots_period` ON `schedule_publish_snapshots` (`period_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_shift_types_dept_status` ON `shift_types` (`department_id`,`status`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_users_role_status` ON `users` (`role`,`status`);