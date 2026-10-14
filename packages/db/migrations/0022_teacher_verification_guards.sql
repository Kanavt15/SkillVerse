CREATE TRIGGER teacher_identity_guard_0 BEFORE INSERT ON courses WHEN NOT EXISTS (SELECT 1 FROM teacher_verifications WHERE user_id=NEW.instructor_id AND verified_at IS NOT NULL AND valid_until>CAST(strftime('%s','now') AS INTEGER)*1000) BEGIN SELECT RAISE(ABORT,'TEACHER_VERIFICATION'); END;
--> statement-breakpoint
CREATE TRIGGER teacher_identity_guard_1 BEFORE UPDATE OF status ON courses WHEN NEW.status IN ('published','in_review') AND NOT EXISTS (SELECT 1 FROM teacher_verifications WHERE user_id=NEW.instructor_id AND verified_at IS NOT NULL AND valid_until>CAST(strftime('%s','now') AS INTEGER)*1000) BEGIN SELECT RAISE(ABORT,'TEACHER_VERIFICATION'); END;
--> statement-breakpoint
CREATE TRIGGER teacher_identity_guard_2 BEFORE INSERT ON instructor_applications WHEN NOT EXISTS (SELECT 1 FROM teacher_verifications WHERE user_id=NEW.user_id AND verified_at IS NOT NULL AND valid_until>CAST(strftime('%s','now') AS INTEGER)*1000) BEGIN SELECT RAISE(ABORT,'TEACHER_VERIFICATION'); END;
--> statement-breakpoint
CREATE TRIGGER teacher_identity_guard_3 BEFORE INSERT ON user_roles WHEN NEW.role='instructor' AND NOT EXISTS (SELECT 1 FROM teacher_verifications WHERE user_id=NEW.user_id AND verified_at IS NOT NULL AND valid_until>CAST(strftime('%s','now') AS INTEGER)*1000) BEGIN SELECT RAISE(ABORT,'TEACHER_VERIFICATION'); END;
