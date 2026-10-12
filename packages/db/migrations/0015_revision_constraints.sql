CREATE UNIQUE INDEX `courses_active_revision_idx` ON `courses` (`source_course_id`) WHERE "courses"."source_course_id" IS NOT NULL AND "courses"."status" IN ('draft', 'rejected', 'in_review');
--> statement-breakpoint
-- Version only lifecycle/content changes; learner counters do not invalidate drafts.
CREATE TRIGGER courses_content_version AFTER UPDATE OF title, subtitle, description, category_id, level, language, price_in_paise, learning_outcomes, requirements, thumbnail_key, status ON courses
BEGIN UPDATE courses SET version = OLD.version + 1 WHERE id = NEW.id; END;
--> statement-breakpoint
CREATE TRIGGER courses_review_lock BEFORE UPDATE OF title, subtitle, description, category_id, level, language, price_in_paise, learning_outcomes, requirements ON courses
WHEN OLD.status = 'in_review' AND NEW.status = 'in_review'
BEGIN SELECT RAISE(ABORT, 'COURSE_REVIEW_LOCK'); END;
--> statement-breakpoint
CREATE TRIGGER sections_review_lock_insert BEFORE INSERT ON sections
WHEN (SELECT status FROM courses WHERE id = NEW.course_id) = 'in_review'
BEGIN SELECT RAISE(ABORT, 'COURSE_REVIEW_LOCK'); END;
--> statement-breakpoint
CREATE TRIGGER sections_content_version_insert AFTER INSERT ON sections
BEGIN UPDATE courses SET version = version + 1 WHERE id = NEW.course_id; END;
--> statement-breakpoint
CREATE TRIGGER sections_review_lock_update BEFORE UPDATE ON sections
WHEN (SELECT status FROM courses WHERE id = NEW.course_id) = 'in_review'
BEGIN SELECT RAISE(ABORT, 'COURSE_REVIEW_LOCK'); END;
--> statement-breakpoint
CREATE TRIGGER sections_content_version_update AFTER UPDATE ON sections
BEGIN UPDATE courses SET version = version + 1 WHERE id = NEW.course_id; END;
--> statement-breakpoint
CREATE TRIGGER sections_review_lock_delete BEFORE DELETE ON sections
WHEN (SELECT status FROM courses WHERE id = OLD.course_id) = 'in_review'
BEGIN SELECT RAISE(ABORT, 'COURSE_REVIEW_LOCK'); END;
--> statement-breakpoint
CREATE TRIGGER sections_content_version_delete AFTER DELETE ON sections
BEGIN UPDATE courses SET version = version + 1 WHERE id = OLD.course_id; END;
--> statement-breakpoint
CREATE TRIGGER lessons_review_lock_insert BEFORE INSERT ON lessons
WHEN (SELECT status FROM courses WHERE id = NEW.course_id) = 'in_review'
BEGIN SELECT RAISE(ABORT, 'COURSE_REVIEW_LOCK'); END;
--> statement-breakpoint
CREATE TRIGGER lessons_content_version_insert AFTER INSERT ON lessons
BEGIN UPDATE courses SET version = version + 1 WHERE id = NEW.course_id; END;
--> statement-breakpoint
CREATE TRIGGER lessons_review_lock_update BEFORE UPDATE ON lessons
WHEN (SELECT status FROM courses WHERE id = NEW.course_id) = 'in_review'
BEGIN SELECT RAISE(ABORT, 'COURSE_REVIEW_LOCK'); END;
--> statement-breakpoint
CREATE TRIGGER lessons_content_version_update AFTER UPDATE ON lessons
BEGIN UPDATE courses SET version = version + 1 WHERE id = NEW.course_id; END;
--> statement-breakpoint
CREATE TRIGGER lessons_review_lock_delete BEFORE DELETE ON lessons
WHEN (SELECT status FROM courses WHERE id = OLD.course_id) = 'in_review'
BEGIN SELECT RAISE(ABORT, 'COURSE_REVIEW_LOCK'); END;
--> statement-breakpoint
CREATE TRIGGER lessons_content_version_delete AFTER DELETE ON lessons
BEGIN UPDATE courses SET version = version + 1 WHERE id = OLD.course_id; END;
--> statement-breakpoint
CREATE TRIGGER course_tags_review_lock_insert BEFORE INSERT ON course_tags
WHEN (SELECT status FROM courses WHERE id = NEW.course_id) = 'in_review'
BEGIN SELECT RAISE(ABORT, 'COURSE_REVIEW_LOCK'); END;
--> statement-breakpoint
CREATE TRIGGER course_tags_content_version_insert AFTER INSERT ON course_tags
BEGIN UPDATE courses SET version = version + 1 WHERE id = NEW.course_id; END;
--> statement-breakpoint
CREATE TRIGGER course_tags_review_lock_update BEFORE UPDATE ON course_tags
WHEN (SELECT status FROM courses WHERE id = NEW.course_id) = 'in_review'
BEGIN SELECT RAISE(ABORT, 'COURSE_REVIEW_LOCK'); END;
--> statement-breakpoint
CREATE TRIGGER course_tags_content_version_update AFTER UPDATE ON course_tags
BEGIN UPDATE courses SET version = version + 1 WHERE id = NEW.course_id; END;
--> statement-breakpoint
CREATE TRIGGER course_tags_review_lock_delete BEFORE DELETE ON course_tags
WHEN (SELECT status FROM courses WHERE id = OLD.course_id) = 'in_review'
BEGIN SELECT RAISE(ABORT, 'COURSE_REVIEW_LOCK'); END;
--> statement-breakpoint
CREATE TRIGGER course_tags_content_version_delete AFTER DELETE ON course_tags
BEGIN UPDATE courses SET version = version + 1 WHERE id = OLD.course_id; END;
--> statement-breakpoint
CREATE TRIGGER lesson_quizzes_review_lock_insert BEFORE INSERT ON lesson_quizzes
WHEN (SELECT status FROM courses WHERE id = (SELECT course_id FROM lessons WHERE id = NEW.lesson_id)) = 'in_review'
BEGIN SELECT RAISE(ABORT, 'COURSE_REVIEW_LOCK'); END;
--> statement-breakpoint
CREATE TRIGGER lesson_quizzes_content_version_insert AFTER INSERT ON lesson_quizzes
BEGIN UPDATE courses SET version = version + 1 WHERE id = (SELECT course_id FROM lessons WHERE id = NEW.lesson_id); END;
--> statement-breakpoint
CREATE TRIGGER lesson_quizzes_review_lock_update BEFORE UPDATE ON lesson_quizzes
WHEN (SELECT status FROM courses WHERE id = (SELECT course_id FROM lessons WHERE id = NEW.lesson_id)) = 'in_review'
BEGIN SELECT RAISE(ABORT, 'COURSE_REVIEW_LOCK'); END;
--> statement-breakpoint
CREATE TRIGGER lesson_quizzes_content_version_update AFTER UPDATE ON lesson_quizzes
BEGIN UPDATE courses SET version = version + 1 WHERE id = (SELECT course_id FROM lessons WHERE id = NEW.lesson_id); END;
--> statement-breakpoint
CREATE TRIGGER lesson_quizzes_review_lock_delete BEFORE DELETE ON lesson_quizzes
WHEN (SELECT status FROM courses WHERE id = (SELECT course_id FROM lessons WHERE id = OLD.lesson_id)) = 'in_review'
BEGIN SELECT RAISE(ABORT, 'COURSE_REVIEW_LOCK'); END;
--> statement-breakpoint
CREATE TRIGGER lesson_quizzes_content_version_delete AFTER DELETE ON lesson_quizzes
BEGIN UPDATE courses SET version = version + 1 WHERE id = (SELECT course_id FROM lessons WHERE id = OLD.lesson_id); END;
