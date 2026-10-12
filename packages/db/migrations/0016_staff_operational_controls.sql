CREATE TABLE `operational_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`bucket` integer NOT NULL,
	`kind` text NOT NULL,
	`count` integer NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `operational_alert_bucket_kind_idx` ON `operational_alerts` (`bucket`,`kind`);--> statement-breakpoint
CREATE INDEX `operational_alert_delivery_idx` ON `operational_alerts` (`state`,`next_attempt_at`);--> statement-breakpoint
CREATE TABLE `operational_metrics` (
	`bucket` integer NOT NULL,
	`scope` text NOT NULL,
	`requests` integer DEFAULT 0 NOT NULL,
	`errors` integer DEFAULT 0 NOT NULL,
	`rate_limited` integer DEFAULT 0 NOT NULL,
	`slow_requests` integer DEFAULT 0 NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`bucket`, `scope`)
);
--> statement-breakpoint
ALTER TABLE `sessions` ADD `step_up_nonce` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `step_up_at` integer;--> statement-breakpoint
ALTER TABLE `feature_flags` ADD `version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_settings` ADD `version` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
INSERT OR IGNORE INTO platform_settings (key, value, description, updated_at, version) VALUES ('operations.error_threshold', '5', 'Operational alert/retention setting.', 1791763200000, 0);

--> statement-breakpoint
INSERT OR IGNORE INTO platform_settings (key, value, description, updated_at, version) VALUES ('operations.slow_ms', '2000', 'Operational alert/retention setting.', 1791763200000, 0);

--> statement-breakpoint
INSERT OR IGNORE INTO platform_settings (key, value, description, updated_at, version) VALUES ('operations.slow_threshold', '20', 'Operational alert/retention setting.', 1791763200000, 0);

--> statement-breakpoint
INSERT OR IGNORE INTO platform_settings (key, value, description, updated_at, version) VALUES ('operations.rate_limit_threshold', '50', 'Operational alert/retention setting.', 1791763200000, 0);

--> statement-breakpoint
INSERT OR IGNORE INTO platform_settings (key, value, description, updated_at, version) VALUES ('operations.retention_days', '7', 'Operational alert/retention setting.', 1791763200000, 0);

--> statement-breakpoint
INSERT OR IGNORE INTO feature_flags (key, enabled, rollout_percent, description, updated_at, version) VALUES ('auth.google', 0, 100, 'Optional Google OAuth sign-in; requires configured provider.', 1791763200000, 0);
