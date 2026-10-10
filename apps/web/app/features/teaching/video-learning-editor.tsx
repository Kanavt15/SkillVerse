/** Optional video timeline fields; real instructor text is validated on the server, with a native form fallback. */
import type { VideoLearning } from '@skillverse/shared';
import { Field } from '~/components/ui/field';
import { inputClass } from '~/components/ui/input';
import type { FormState } from '~/lib/forms';
import { videoLearningFields } from './video-learning-form';

/** Renders editable chapters, transcript cues and reflection prompts without synthesising any content. */
export function VideoLearningEditor({
  initial,
  state,
}: {
  initial: VideoLearning;
  state: FormState | undefined;
}) {
  const saved = videoLearningFields(initial);
  return (
    <section
      className="space-y-5 rounded-xl border border-border bg-bg-subtle p-4 sm:p-6"
      aria-labelledby="video-learning-heading"
    >
      <div>
        <h2 id="video-learning-heading" className="text-lg font-semibold">
          Make the video easier to learn from
        </h2>
        <p className="mt-2 text-sm text-fg-muted">
          Add your own chapters, transcript and practice prompts. These fields are optional. Use one
          entry per line, in timestamp order; leave a field empty to remove its entries.
        </p>
      </div>
      <Field
        name="videoChapters"
        label="Video chapters"
        hint="Format: MM:SS | Chapter title. Up to 60 chapters. Whole seconds and HH:MM:SS also work. Start at 0:00 if you want an introduction chapter."
        errors={state?.fieldErrors?.videoChapters}
      >
        {(p) => (
          <textarea
            {...p}
            rows={4}
            className={inputClass}
            maxLength={12_000}
            defaultValue={state?.values?.videoChapters ?? saved.videoChapters}
          />
        )}
      </Field>
      <Field
        name="videoTranscript"
        label="Timed transcript"
        hint="Format: MM:SS | Spoken text. Up to 400 cues. Learners can search your text and jump to each moment. Use the video's own captions for in-player captions."
        errors={state?.fieldErrors?.videoTranscript}
      >
        {(p) => (
          <textarea
            {...p}
            rows={7}
            className={inputClass}
            maxLength={48_000}
            defaultValue={state?.values?.videoTranscript ?? saved.videoTranscript}
          />
        )}
      </Field>
      <Field
        name="videoCheckpoints"
        label="Practice checkpoints"
        hint="Format: MM:SS | Reflection prompt | Optional explanation. Up to 30 prompts. Learners open these themselves and can save a reflection as a private note. These do not grade or change lesson completion."
        errors={state?.fieldErrors?.videoCheckpoints}
      >
        {(p) => (
          <textarea
            {...p}
            rows={5}
            className={inputClass}
            maxLength={24_000}
            defaultValue={state?.values?.videoCheckpoints ?? saved.videoCheckpoints}
          />
        )}
      </Field>
      <p className="text-xs text-fg-subtle">
        Avoid the | character inside text. Keep the combined content under 48 KB; split longer
        videos into shorter lessons.
      </p>
    </section>
  );
}
