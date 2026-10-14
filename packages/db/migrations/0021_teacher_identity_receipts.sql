CREATE TABLE `teacher_verifications` (
	`user_id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`session_hash` text NOT NULL,
	`state_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`verified_at` integer,
	`valid_until` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teacher_verifications_provider_id_unique` ON `teacher_verifications` (`provider_id`);