CREATE TABLE `content_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`course_id` text NOT NULL,
	`reporter_user_id` text NOT NULL,
	`reason` text NOT NULL,
	`details` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`reviewed_by` text,
	`reviewed_at` integer,
	`review_notes` text,
	`decision_token` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reporter_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_reports_reporter_target_idx` ON `content_reports` (`reporter_user_id`,`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `content_reports_status_idx` ON `content_reports` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `discussion_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`lesson_id` text,
	`author_user_id` text,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`timestamp_seconds` integer,
	`accepted_reply_id` text,
	`hidden_at` integer,
	`moderated_by` text,
	`moderation_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`moderated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `discussion_questions_course_idx` ON `discussion_questions` (`course_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `discussion_questions_lesson_idx` ON `discussion_questions` (`lesson_id`);--> statement-breakpoint
CREATE TABLE `discussion_replies` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`author_user_id` text,
	`body` text NOT NULL,
	`hidden_at` integer,
	`moderated_by` text,
	`moderation_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `discussion_questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`moderated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `discussion_replies_question_idx` ON `discussion_replies` (`question_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `reviews` ADD `hidden_at` integer;--> statement-breakpoint
ALTER TABLE `reviews` ADD `moderated_by` text REFERENCES users(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `reviews` ADD `moderation_notes` text;
