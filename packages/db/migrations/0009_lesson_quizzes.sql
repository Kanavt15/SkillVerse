CREATE TABLE `lesson_quizzes` (
	`lesson_id` text PRIMARY KEY NOT NULL,
	`revision` text NOT NULL,
	`definition` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quiz_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`enrollment_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`quiz_revision` text NOT NULL,
	`answers` text NOT NULL,
	`result` text NOT NULL,
	`passed` integer NOT NULL,
	`receipt_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quiz_attempts_enrollment_lesson_idx` ON `quiz_attempts` (`enrollment_id`,`lesson_id`,`created_at`);