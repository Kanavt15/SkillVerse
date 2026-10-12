CREATE INDEX IF NOT EXISTS `audit_created_idx` ON `audit_logs` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `audit_target_id_idx` ON `audit_logs` (`target_id`,`created_at`,`id`);
--> statement-breakpoint
INSERT OR IGNORE INTO platform_settings (key, value, description, updated_at, version) VALUES ('operations.request_threshold', '5000', 'Operational request volume alert setting.', 1791763200000, 0);
