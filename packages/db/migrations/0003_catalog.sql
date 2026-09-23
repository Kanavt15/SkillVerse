CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`parent_id` text,
	`icon` text DEFAULT 'book-open' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE INDEX `categories_parent_idx` ON `categories` (`parent_id`,`position`);--> statement-breakpoint
CREATE TABLE `course_review_events` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`event` text NOT NULL,
	`actor_id` text,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `course_review_events_course_idx` ON `course_review_events` (`course_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `course_tags` (
	`course_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`course_id`, `tag_id`),
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `course_tags_tag_idx` ON `course_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`instructor_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`category_id` text,
	`level` text DEFAULT 'all_levels' NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`price_in_paise` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'INR' NOT NULL,
	`learning_outcomes` text DEFAULT '[]' NOT NULL,
	`requirements` text DEFAULT '[]' NOT NULL,
	`thumbnail_key` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`is_plus_eligible` integer DEFAULT false NOT NULL,
	`lesson_count` integer DEFAULT 0 NOT NULL,
	`duration_minutes` integer DEFAULT 0 NOT NULL,
	`enrollment_count` integer DEFAULT 0 NOT NULL,
	`rating_sum` integer DEFAULT 0 NOT NULL,
	`rating_count` integer DEFAULT 0 NOT NULL,
	`submitted_at` integer,
	`published_at` integer,
	`review_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`instructor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `courses_slug_unique` ON `courses` (`slug`);--> statement-breakpoint
CREATE INDEX `courses_status_published_idx` ON `courses` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `courses_category_status_idx` ON `courses` (`category_id`,`status`);--> statement-breakpoint
CREATE INDEX `courses_instructor_idx` ON `courses` (`instructor_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `instructor_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`headline` text NOT NULL,
	`topics` text DEFAULT '[]' NOT NULL,
	`experience` text NOT NULL,
	`sample_url` text,
	`reviewer_id` text,
	`review_notes` text,
	`reviewed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `instructor_applications_status_idx` ON `instructor_applications` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `instructor_applications_user_idx` ON `instructor_applications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`section_id` text NOT NULL,
	`title` text NOT NULL,
	`type` text DEFAULT 'video' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`is_preview` integer DEFAULT false NOT NULL,
	`duration_minutes` integer DEFAULT 0 NOT NULL,
	`content_markdown` text DEFAULT '' NOT NULL,
	`video_provider` text,
	`video_ref` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `lessons_section_idx` ON `lessons` (`section_id`,`position`);--> statement-breakpoint
CREATE INDEX `lessons_course_idx` ON `lessons` (`course_id`);--> statement-breakpoint
CREATE TABLE `sections` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`title` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sections_course_idx` ON `sections` (`course_id`,`position`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_slug_unique` ON `tags` (`slug`);