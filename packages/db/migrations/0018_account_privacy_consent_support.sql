CREATE TABLE `account_privacy` (
	`user_id` text PRIMARY KEY NOT NULL,
	`birth_date` text,
	`terms_version` text NOT NULL,
	`privacy_version` text NOT NULL,
	`instructor_version` text,
	`agreed_at` integer NOT NULL,
	`guardian_request_id` text,
	`external_media` integer DEFAULT false NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`guardian_request_id`) REFERENCES `guardian_requests`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `guardian_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`child_email_hash` text,
	`child_birth_date` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`used_by_user_id` text,
	`used_at` integer,
	FOREIGN KEY (`request_id`) REFERENCES `guardian_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`used_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `guardian_invitations_request_idx` ON `guardian_invitations` (`request_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `guardian_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`guardian_user_id` text NOT NULL,
	`scope` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`consent_version` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`identity_method` text,
	`verification_reference` text,
	`reviewed_by` text,
	`review_notes` text DEFAULT '' NOT NULL,
	`reviewed_at` integer,
	`verification_valid_until` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`guardian_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `guardian_requests_owner_idx` ON `guardian_requests` (`guardian_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `guardian_requests_status_idx` ON `guardian_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `privacy_export_parts` (
	`export_id` text NOT NULL,
	`part` integer NOT NULL,
	`body` text NOT NULL,
	PRIMARY KEY(`export_id`, `part`),
	FOREIGN KEY (`export_id`) REFERENCES `privacy_exports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `privacy_exports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`state` text DEFAULT 'queued' NOT NULL,
	`resource_index` integer DEFAULT 0 NOT NULL,
	`cursor` text DEFAULT '' NOT NULL,
	`part` integer DEFAULT 0 NOT NULL,
	`bytes` integer DEFAULT 0 NOT NULL,
	`lease_nonce` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`error` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `privacy_exports_owner_idx` ON `privacy_exports` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `privacy_exports_state_idx` ON `privacy_exports` (`state`,`lease_until`);--> statement-breakpoint
CREATE TABLE `support_replies` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`staff_user_id` text,
	`body` text NOT NULL,
	`delivery_state` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `support_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`staff_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `support_replies_request_idx` ON `support_replies` (`request_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `support_replies_delivery_idx` ON `support_replies` (`delivery_state`,`next_attempt_at`);--> statement-breakpoint
CREATE TABLE `support_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`email` text NOT NULL,
	`subject` text NOT NULL,
	`message` text NOT NULL,
	`category` text NOT NULL,
	`status` text DEFAULT 'unverified' NOT NULL,
	`verification_hash` text,
	`verification_expires_at` integer,
	`verified_at` integer,
	`version` integer DEFAULT 0 NOT NULL,
	`resolved_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `support_requests_email_idx` ON `support_requests` (`email`,`created_at`);--> statement-breakpoint
CREATE INDEX `support_requests_status_idx` ON `support_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `support_verification_idx` ON `support_requests` (`verification_hash`);--> statement-breakpoint
ALTER TABLE `sessions` ADD `privacy_access_until` integer;