DROP INDEX `users_status_idx`;--> statement-breakpoint
CREATE INDEX `users_created_idx` ON `users` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `users_status_idx` ON `users` (`status`,`created_at`,`id`);--> statement-breakpoint
DROP INDEX `audit_target_idx`;--> statement-breakpoint
CREATE INDEX `audit_target_idx` ON `audit_logs` (`target_type`,`target_id`,`created_at`,`id`);