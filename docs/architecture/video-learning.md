# Authored video learning

Video lessons can contain optional chapters, a timed transcript and reflection checkpoints. Instructors supply all text. There is no automatic transcript generation, fabricated activity or placeholder timeline in learner responses.

## Storage and contracts

Additive migration `0010_video_learning.sql` adds `lessons.video_learning`, a JSON text column defaulting to `{}`. Existing lessons remain playable with empty collections. The shared `videoLearningSchema` validates `chapters`, `transcript` and `checkpoints` on Studio writes and documents owner/staff and player responses in OpenAPI. A PATCH that omits `videoLearning` preserves the stored value; empty collections remove entries. Non-video lessons reject timeline writes.

Each entry has `atSeconds`, an integer from 0 to 36,000. Each collection must be strictly increasing without duplicate moments. Limits: 60 chapters, 400 transcript cues, 30 checkpoints and 48,000 combined UTF-8 bytes inside the existing 64 KB API request limit. Text is a single line without `|`, enabling lossless native-form editing. Invalid legacy JSON reads as an empty timeline, never substitute content.

## Authoring and review

The Studio video editor uses optional native textareas. Enter one item per line:

```text
MM:SS | Chapter title
MM:SS | Spoken text
MM:SS | Reflection prompt | Optional explanation
```

Whole seconds and `HH:MM:SS` also work. Errors identify the original line, including blank lines, and preserve submitted text. Saving works without JavaScript. Staff inspect every collection as escaped text inside the existing review page; transcript inspection has a bounded scroll area.

## Access and interaction

The existing lesson policy gates the entire timeline. Public catalog, instructor and curriculum responses never include it. Published previews include their own timeline; full lessons require enrollment in that exact course. Archived-course access follows the existing enrollment policy. Notes and progress remain private, and GET navigation never marks a lesson complete.

Chapter and transcript links use the validated `t` query and a video anchor. The player rebuilds its iframe from a validated provider reference using [YouTube's start parameter](https://developers.google.com/youtube/player_parameters#start) or [Vimeo's time fragment](https://help.vimeo.com/hc/en-us/articles/12425821012497-Start-playback-at-a-specific-timecode). Jumping reloads the embed. Highlighting follows the selected timestamp, not live playback. No provider SDK, third-party parent-page script or expanded CSP is needed. Playback controls remain inside the provider player.

The transcript supports case-insensitive client search, shown after hydration. Without JavaScript it remains fully readable and timestamp links still work. Empty collections are omitted. Shortcuts run only while the **Lesson keyboard navigation** bar itself is focused: left/right arrows select adjacent chapters; Shift plus an arrow opens an accessible adjacent lesson. They do not capture typing in forms, browser shortcuts or keys inside the provider iframe. Ordinary links remain available.

Checkpoints are manually opened, ungraded reflections. They do not automatically pause playback, block completion or grant a score. Enrolled learners save reflections through the existing private timestamped-note action. The form clears after saving. Optional instructor explanations appear on request.

## Verification and rollout

Shared tests cover timestamp parsing, ordering, text/list/UTF-8 limits and legacy JSON. Form tests cover Unicode round trips and line feedback. Real D1 API tests cover partial edits, protected content, previews, ownership, non-video rejection, cross-course access and the review lock. Chromium covers authoring, staff inspection/publication, transcript search, escaped script text, keyboard scope, reflection notes, both themes, mobile layout, axe scans and native timestamp links without JavaScript. Provider playback/network availability is outside these tests; iframe requests are isolated while the real URL construction is checked.

Apply `npm run db:migrate:local` before local preview and the new migration in staging/production before deploying code that selects the new column. Storage adds at most 48 KB per populated lesson and no new table, paid service or background job. See [ADR 0009](adr/0009-authored-video-learning.md).
