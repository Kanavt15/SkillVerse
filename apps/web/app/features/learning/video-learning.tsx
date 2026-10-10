/** Accessible chapter navigation, searchable authored transcripts and private checkpoint reflections. */
import { useId, useState, type KeyboardEvent } from 'react';
import { Form, Link, useNavigate } from 'react-router';
import { BookOpen, ChevronLeft, ChevronRight, ListVideo, Search } from 'lucide-react';
import { formatVideoTimestamp, type VideoLearning } from '@skillverse/shared';
import { Button } from '~/components/ui/button';
import { inputClass } from '~/components/ui/input';
import { SubmitButton } from '~/components/ui/submit-button';
import { useHydrated } from '~/lib/use-hydrated';

/** Shows only stored content; checkpoints reuse the enrollment-protected private-note action. */
export function VideoLearningPanel({
  timeline,
  moment,
  enrolled,
  previous,
  next,
  noteVersion,
}: {
  timeline: VideoLearning;
  moment: number | null;
  enrolled: boolean;
  previous: string | null;
  next: string | null;
  noteVersion: string;
}) {
  const [query, setQuery] = useState('');
  const hydrated = useHydrated();
  const searchId = useId(),
    helpId = useId();
  const navigate = useNavigate();
  const cueHref = (seconds: number) => `?t=${seconds}#lesson-video`;
  const active = timeline.chapters.findLastIndex((chapter) => chapter.atSeconds <= (moment ?? 0));
  const previousChapter = timeline.chapters[active - 1];
  const nextChapter = timeline.chapters[active + 1];
  const normalized = query.trim().toLocaleLowerCase();
  const cues = timeline.transcript.filter((cue) =>
    cue.text.toLocaleLowerCase().includes(normalized),
  );

  function shortcut(event: KeyboardEvent<HTMLDivElement>) {
    // Shortcuts only run on this focused bar, never while writing a note or inside the provider iframe.
    if (
      event.target !== event.currentTarget ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.repeat
    )
      return;
    const forward = event.key === 'ArrowRight',
      back = event.key === 'ArrowLeft';
    if (!forward && !back) return;
    const target = event.shiftKey
      ? forward
        ? next
        : previous
      : forward
        ? nextChapter && cueHref(nextChapter.atSeconds)
        : previousChapter && cueHref(previousChapter.atSeconds);
    if (!target) return;
    event.preventDefault();
    void navigate(target, { preventScrollReset: true });
  }

  return (
    <div className="mt-5 space-y-5">
      <div
        tabIndex={0}
        role="region"
        aria-label="Lesson keyboard navigation"
        aria-describedby={helpId}
        onKeyDown={shortcut}
        className="video-shortcuts"
      >
        <p className="font-semibold">Keyboard navigation</p>
        <p id={helpId} className="mt-1 text-xs text-fg-muted">
          Focus this bar: {timeline.chapters.length > 0 && '← / → jump between chapters; '}Shift + ←
          / → open the previous or next accessible lesson. Use the video's own controls for
          playback.
        </p>
      </div>
      {timeline.chapters.length > 0 && (
        <nav aria-label="Video chapters" className="video-panel">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ListVideo className="size-5 text-brand" aria-hidden="true" /> Chapters
          </h2>
          <ol className="mt-4 grid gap-2 sm:grid-cols-2">
            {timeline.chapters.map((chapter, index) => (
              <li key={chapter.atSeconds}>
                <Link
                  to={cueHref(chapter.atSeconds)}
                  preventScrollReset
                  className="video-chapter"
                  aria-current={active === index ? 'location' : undefined}
                >
                  <span className="video-time">{formatVideoTimestamp(chapter.atSeconds)}</span>
                  <span>{chapter.title}</span>
                </Link>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            {previousChapter && (
              <Button
                asLink
                variant="ghost"
                size="sm"
                to={cueHref(previousChapter.atSeconds)}
                className="max-w-full whitespace-normal"
                preventScrollReset
              >
                <ChevronLeft aria-hidden="true" /> Previous chapter
              </Button>
            )}
            {nextChapter && (
              <Button
                asLink
                variant="ghost"
                size="sm"
                to={cueHref(nextChapter.atSeconds)}
                className="max-w-full whitespace-normal"
                preventScrollReset
              >
                Next chapter <ChevronRight aria-hidden="true" />
              </Button>
            )}
          </div>
          <p className="mt-3 text-xs text-fg-subtle">
            Highlighted chapter follows your selected timestamp. Jumping reloads the embedded video
            at that moment.
          </p>
        </nav>
      )}
      {timeline.transcript.length > 0 && (
        <details className="video-panel video-disclosure">
          <summary className="cursor-pointer text-lg font-semibold">
            Read transcript{' '}
            <span className="ml-2 text-sm font-normal text-fg-muted">
              {timeline.transcript.length} cues
            </span>
          </summary>
          {hydrated && (
            <div className="relative mt-4">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-3.5 left-3 size-4 text-fg-muted"
              />
              <label htmlFor={searchId} className="sr-only">
                Search transcript
              </label>
              <input
                id={searchId}
                type="search"
                className={`${inputClass} pl-10`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a word or idea"
                maxLength={100}
              />
            </div>
          )}
          <p className="mt-2 text-xs text-fg-muted" role="status" aria-live="polite">
            {normalized
              ? `${cues.length} matching ${cues.length === 1 ? 'cue' : 'cues'}`
              : 'Transcript provided by the instructor.'}
          </p>
          <ol className="video-transcript mt-4">
            {cues.map((cue) => (
              <li
                key={cue.atSeconds}
                className="flex items-start gap-3 border-b border-border py-3 last:border-0"
              >
                <Link
                  to={cueHref(cue.atSeconds)}
                  preventScrollReset
                  className="video-time shrink-0 rounded-md p-2 hover:bg-brand-subtle"
                  aria-label={`Jump to ${formatVideoTimestamp(cue.atSeconds)} in transcript`}
                >
                  {formatVideoTimestamp(cue.atSeconds)}
                </Link>
                <p className="min-w-0 pt-2 text-sm leading-7">{cue.text}</p>
              </li>
            ))}
          </ol>
          {cues.length === 0 && (
            <p className="py-5 text-sm text-fg-muted">
              No transcript cues match. Try another word or clear the search.
            </p>
          )}
        </details>
      )}
      {timeline.checkpoints.length > 0 && (
        <section className="video-panel" aria-label="Practice checkpoints">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BookOpen className="size-5 text-accent" aria-hidden="true" /> Pause and put it into
            practice
          </h2>
          <p className="mt-2 text-sm text-fg-muted">
            Open a checkpoint when you're ready. These reflections are for practice and do not
            change your score or lesson completion.
          </p>
          <div className="mt-4 space-y-3">
            {timeline.checkpoints.map((checkpoint) => (
              <details key={checkpoint.atSeconds} className="rounded-lg border border-border p-4">
                <summary className="cursor-pointer text-sm font-semibold">
                  Checkpoint at {formatVideoTimestamp(checkpoint.atSeconds)}
                </summary>
                <p className="mt-3 text-sm leading-7">{checkpoint.prompt}</p>
                <Button
                  asLink
                  to={cueHref(checkpoint.atSeconds)}
                  preventScrollReset
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                >
                  Revisit {formatVideoTimestamp(checkpoint.atSeconds)}
                </Button>
                {enrolled && (
                  <Form
                    method="post"
                    key={`${checkpoint.atSeconds}:${noteVersion}`}
                    className="mt-4 space-y-3"
                  >
                    <input type="hidden" name="intent" value="note" />
                    <input type="hidden" name="timestampSeconds" value={checkpoint.atSeconds} />
                    <label className="block text-sm font-medium">
                      Your reflection at {formatVideoTimestamp(checkpoint.atSeconds)}
                      <textarea
                        name="body"
                        rows={3}
                        maxLength={5000}
                        required
                        className={`${inputClass} mt-2`}
                      />
                    </label>
                    <SubmitButton
                      variant="secondary"
                      pendingText="Saving…"
                      className="h-auto min-h-11 max-w-full whitespace-normal px-3 py-2"
                    >
                      Save reflection as private note
                    </SubmitButton>
                  </Form>
                )}
                {checkpoint.explanation && (
                  <details className="mt-4 border-t border-border pt-3">
                    <summary className="cursor-pointer text-sm font-medium text-brand">
                      Show instructor explanation
                    </summary>
                    <p className="mt-3 text-sm leading-7">{checkpoint.explanation}</p>
                  </details>
                )}
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
