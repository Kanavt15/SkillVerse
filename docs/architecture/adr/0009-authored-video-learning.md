# ADR 0009: Authored video timelines with native timestamp navigation

- Status: Accepted
- Date: 2026-10-10

## Context

Phase 1 needs video chapters, transcripts and practice checkpoints. Existing lessons use provider embeds and enrollment-protected bodies. Navigation should preserve those permissions, native forms, completion rules and CSP.

## Decision

Store a bounded, validated optional JSON timeline per video lesson. Return it only through authorized editor/staff and lesson-player paths. Use instructor-authored content, native timestamp links and focused keyboard shortcuts. Reuse private timestamped notes for reflections; keep checkpoints ungraded and learner-opened.

Use supported embed timestamps rather than provider SDK scripts in the parent page. Highlighting follows the selected URL timestamp. Transcript search is an enhancement; reading and timestamp navigation work without JavaScript.

## Consequences

- Old lessons need no fabricated content or backfill; the additive column defaults to an empty timeline.
- The same policy protects video references, transcripts, chapters and prompts together.
- Timestamp jumps reload the embed. Live playback tracking and automatic pauses are future enhancements.
- No paid infrastructure, external parent-page scripts or CSP allowances are added.
- Native text fields keep authoring usable without JavaScript; each cue is a single line without `|`.
