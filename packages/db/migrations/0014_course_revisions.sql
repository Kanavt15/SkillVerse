ALTER TABLE `courses` ADD `source_course_id` text REFERENCES courses(id);--> statement-breakpoint
ALTER TABLE `courses` ADD `base_version` integer;--> statement-breakpoint
ALTER TABLE `courses` ADD `version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `lessons` ADD `source_lesson_id` text;--> statement-breakpoint
ALTER TABLE `lessons` ADD `retired_at` integer;--> statement-breakpoint
ALTER TABLE `sections` ADD `source_section_id` text;--> statement-breakpoint
ALTER TABLE `sections` ADD `retired_at` integer;