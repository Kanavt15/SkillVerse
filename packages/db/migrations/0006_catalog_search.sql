-- FTS5 indexes instructor-authored course text. Public queries additionally
-- require published status and an active instructor; drafts never leak.
CREATE VIRTUAL TABLE courses_fts USING fts5(title, subtitle, description, content='courses', content_rowid='rowid', tokenize='unicode61');
INSERT INTO courses_fts(courses_fts) VALUES ('rebuild');
CREATE TRIGGER courses_fts_insert AFTER INSERT ON courses BEGIN
  INSERT INTO courses_fts(rowid, title, subtitle, description) VALUES (new.rowid, new.title, new.subtitle, new.description);
END;
CREATE TRIGGER courses_fts_delete AFTER DELETE ON courses BEGIN
  INSERT INTO courses_fts(courses_fts, rowid, title, subtitle, description) VALUES ('delete', old.rowid, old.title, old.subtitle, old.description);
END;
CREATE TRIGGER courses_fts_update AFTER UPDATE OF title, subtitle, description ON courses BEGIN
  INSERT INTO courses_fts(courses_fts, rowid, title, subtitle, description) VALUES ('delete', old.rowid, old.title, old.subtitle, old.description);
  INSERT INTO courses_fts(rowid, title, subtitle, description) VALUES (new.rowid, new.title, new.subtitle, new.description);
END;
