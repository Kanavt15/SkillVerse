CREATE TABLE `mfa_recovery_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mfa_recovery_user_idx` ON `mfa_recovery_codes` (`user_id`);--> statement-breakpoint
CREATE TABLE `mfa_totp` (
	`user_id` text PRIMARY KEY NOT NULL,
	`secret_encrypted` text NOT NULL,
	`enabled_at` integer,
	`last_used_step` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `oauth_accounts` (
	`provider` text NOT NULL,
	`provider_user_id` text NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`provider`, `provider_user_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `oauth_accounts_user_idx` ON `oauth_accounts` (`user_id`);--> statement-breakpoint
ALTER TABLE `sessions` ADD `mfa_attempts` integer DEFAULT 0 NOT NULL;