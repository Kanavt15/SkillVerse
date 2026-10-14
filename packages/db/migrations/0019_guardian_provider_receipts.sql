CREATE TABLE `guardian_verifications` (
	`request_id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`session_hash` text NOT NULL,
	`state_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`verified_at` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `guardian_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guardian_verifications_provider_id_unique` ON `guardian_verifications` (`provider_id`);