/**
 * /studio/courses/:courseId: the course editor.
 *
 * Every change is a plain <Form method="post"> with an `intent` (works without
 * JavaScript); the action calls the Studio API and the page reloads its data.
 * Intents: details, add-section, rename-section, delete-section, move-section,
 * add-lesson, move-lesson, delete-lesson, submit, withdraw, archive.
 */
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronRight,
  Circle,
  FileText,
  PlayCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import { data, Form, Link } from 'react-router';
import {
  COURSE_LANGUAGES,
  COURSE_LEVELS,
  LEVEL_LABELS,
  createLessonSchema,
  rupeesToPaise,
  sectionSchema,
  submissionChecklist,
  updateCourseSchema,
} from '@skillverse/shared';
import type { Route } from './+types/course';
import { Alert } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Field } from '~/components/ui/field';
import { Input, inputClass } from '~/components/ui/input';
import { SubmitButton } from '~/components/ui/submit-button';
import { CourseStatusBadge, durationLabel, priceLabel } from '~/features/teaching/course-status';
import type { Category, EditorCourse, EditorSection } from '~/features/teaching/types';
import { api, apiGet, type ApiResult } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { formValues, validate, type FieldErrors } from '~/lib/forms';
import { requireId } from '~/lib/params';

export function meta({ data: loaderData }: Route.MetaArgs) {
  const title = loaderData?.course.title ?? 'Course';
  return [{ title: `${title} · Studio | SkillVerse` }, { name: 'robots', content: 'noindex' }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const [course, categories] = await Promise.all([
    api<EditorCourse>(request, `/api/v1/studio/courses/${requireId(params.courseId)}`),
    apiGet<Category[]>('/api/v1/categories').catch(() => [] as Category[]),
  ]);
  if (!course.ok) throw new Response(course.error.message, { status: course.status });
  return { course: course.data, categories };
}

// ─── Action ──────────────────────────────────────────────────────────────────

interface ActionState {
  intent: string;
  success?: string;
  formError?: string;
  fieldErrors?: FieldErrors;
  values?: Record<string, string>;
  checklist?: string[];
}

function fail(intent: string, state: Omit<ActionState, 'intent'>, status = 400) {
  return data<ActionState>({ intent, ...state }, { status });
}

function fromApi(
  intent: string,
  res: Extract<ApiResult<unknown>, { ok: false }>,
  values?: Record<string, string>,
) {
  const checklist = res.error.fields?.checklist;
  if (checklist) return fail(intent, { formError: res.error.message, checklist }, res.status);
  return fail(
    intent,
    {
      fieldErrors: res.error.fields,
      formError: res.error.fields ? undefined : res.error.message,
      values,
    },
    res.status,
  );
}

const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

const DETAIL_FIELDS = [
  'title',
  'subtitle',
  'description',
  'categoryId',
  'level',
  'language',
  'price',
  'learningOutcomes',
  'requirements',
  'tags',
] as const;

/** Swaps `id` with its neighbour; returns null when it's already at that end. */
function moved(ids: string[], id: string, direction: string): string[] | null {
  const i = ids.indexOf(id);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return null;
  const next = [...ids];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireUser(request);
  const courseId = requireId(params.courseId);
  const form = await request.formData();
  const intent = String(form.get('intent') ?? '');
  const str = (name: string) => {
    const v = form.get(name);
    return typeof v === 'string' ? v : '';
  };
  const base = `/api/v1/studio/courses/${courseId}`;
  const call = (path: string, method: string, body?: unknown) =>
    api<EditorCourse>(request, path, { method, body });

  switch (intent) {
    case 'details': {
      const values = formValues(form, DETAIL_FIELDS);
      let priceInPaise: number;
      try {
        priceInPaise = values.price.trim() === '' ? 0 : rupeesToPaise(values.price);
      } catch {
        return fail(intent, {
          fieldErrors: { priceInPaise: ['Enter a price in rupees, e.g. 499'] },
          values,
        });
      }
      const parsed = validate(updateCourseSchema, {
        title: values.title,
        subtitle: values.subtitle,
        description: values.description,
        categoryId: values.categoryId || null,
        level: values.level,
        language: values.language,
        priceInPaise,
        learningOutcomes: lines(values.learningOutcomes),
        requirements: lines(values.requirements),
        tags: values.tags
          .split(',')
          .map((t) => t.trim().replace(/\s+/g, '-'))
          .filter(Boolean),
      });
      if (!parsed.ok) return fail(intent, { fieldErrors: parsed.fieldErrors, values });
      const res = await call(base, 'PATCH', parsed.data);
      if (!res.ok) return fromApi(intent, res, values);
      return { intent, success: 'Details saved.' };
    }

    case 'add-section': {
      const parsed = validate(sectionSchema, { title: str('title') });
      if (!parsed.ok) return fail(intent, { fieldErrors: parsed.fieldErrors });
      const res = await call(`${base}/sections`, 'POST', parsed.data);
      return res.ok ? { intent, success: 'Section added.' } : fromApi(intent, res);
    }

    case 'rename-section': {
      const sectionId = requireId(str('sectionId'));
      const parsed = validate(sectionSchema, { title: str('title') });
      if (!parsed.ok) return fail(intent, { fieldErrors: parsed.fieldErrors });
      const res = await call(`/api/v1/studio/sections/${sectionId}`, 'PATCH', parsed.data);
      return res.ok ? { intent, success: 'Section renamed.' } : fromApi(intent, res);
    }

    case 'delete-section': {
      const sectionId = requireId(str('sectionId'));
      const res = await call(`/api/v1/studio/sections/${sectionId}`, 'DELETE');
      return res.ok ? { intent, success: 'Section deleted.' } : fromApi(intent, res);
    }

    case 'move-section': {
      const current = await call(base, 'GET');
      if (!current.ok) return fromApi(intent, current);
      const ids = moved(
        current.data.sections.map((s) => s.id),
        str('sectionId'),
        str('direction'),
      );
      if (!ids) return { intent };
      const res = await call(`${base}/sections/reorder`, 'POST', { ids });
      return res.ok ? { intent } : fromApi(intent, res);
    }

    case 'add-lesson': {
      const sectionId = requireId(str('sectionId'));
      const parsed = validate(createLessonSchema, { title: str('title'), type: str('type') });
      if (!parsed.ok) {
        return fail(intent, { fieldErrors: parsed.fieldErrors, values: { sectionId } });
      }
      const res = await call(`/api/v1/studio/sections/${sectionId}/lessons`, 'POST', parsed.data);
      return res.ok ? { intent, success: 'Lesson added.' } : fromApi(intent, res, { sectionId });
    }

    case 'move-lesson': {
      const sectionId = requireId(str('sectionId'));
      const current = await call(base, 'GET');
      if (!current.ok) return fromApi(intent, current);
      const section = current.data.sections.find((s) => s.id === sectionId);
      const ids =
        section &&
        moved(
          section.lessons.map((l) => l.id),
          str('lessonId'),
          str('direction'),
        );
      if (!ids) return { intent };
      const res = await call(`/api/v1/studio/sections/${sectionId}/lessons/reorder`, 'POST', {
        ids,
      });
      return res.ok ? { intent } : fromApi(intent, res);
    }

    case 'delete-lesson': {
      const lessonId = requireId(str('lessonId'));
      const res = await call(`/api/v1/studio/lessons/${lessonId}`, 'DELETE');
      return res.ok ? { intent, success: 'Lesson deleted.' } : fromApi(intent, res);
    }

    case 'submit': {
      const res = await call(`${base}/submit`, 'POST');
      return res.ok
        ? { intent, success: "Submitted! We'll email you when the review is done." }
        : fromApi(intent, res);
    }

    case 'withdraw': {
      const res = await call(`${base}/withdraw`, 'POST');
      return res.ok
        ? { intent, success: 'Withdrawn. You can edit the course again.' }
        : fromApi(intent, res);
    }

    case 'archive': {
      const res = await call(`${base}/archive`, 'POST');
      return res.ok ? { intent, success: 'Course archived.' } : fromApi(intent, res);
    }

    default:
      return fail(intent, { formError: 'Unknown action.' });
  }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CourseEditor({ loaderData, actionData }: Route.ComponentProps) {
  const { course, categories } = loaderData;
  const state = actionData as ActionState | undefined;
  const locked = course.status === 'in_review' || course.status === 'archived';
  const checklist = submissionChecklist(course);
  const canSubmit = course.status === 'draft' || course.status === 'rejected';

  return (
    <>
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-fg-muted">
        <Link to="/studio" className="hover:text-fg">
          Studio
        </Link>
        <ChevronRight className="size-4" aria-hidden="true" />
        <span className="truncate text-fg">{course.title}</span>
      </nav>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold break-words">{course.title}</h1>
            <CourseStatusBadge status={course.status} />
          </div>
          <p className="mt-1 text-sm text-fg-muted">
            {course.lessonCount} {course.lessonCount === 1 ? 'lesson' : 'lessons'} ·{' '}
            {durationLabel(course.durationMinutes)} · {priceLabel(course.priceInPaise)}
          </p>
        </div>
        <StatusActions status={course.status} canSubmit={canSubmit && checklist.length === 0} />
      </header>

      <div className="mt-6 space-y-3">
        {state?.success && <Alert tone="success">{state.success}</Alert>}
        {state?.formError && state.intent !== 'details' && (
          <Alert tone="danger">
            <p>{state.formError}</p>
            {state.checklist && (
              <ul className="mt-2 list-disc pl-5">
                {state.checklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}
        <StatusBanner course={course} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-8">
          <DetailsCard
            course={course}
            categories={categories}
            locked={locked}
            state={state?.intent === 'details' ? state : undefined}
          />
          <CurriculumCard course={course} locked={locked} state={state} />
        </div>
        <aside className="space-y-6">
          <ChecklistCard checklist={checklist} status={course.status} />
        </aside>
      </div>
    </>
  );
}

function StatusActions({
  status,
  canSubmit,
}: {
  status: EditorCourse['status'];
  canSubmit: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {(status === 'draft' || status === 'rejected') && (
        <Form method="post">
          <SubmitButton
            name="intent"
            value="submit"
            pendingText="Submitting…"
            className={canSubmit ? '' : 'opacity-60'}
          >
            Submit for review
          </SubmitButton>
        </Form>
      )}
      {status === 'in_review' && (
        <Form method="post">
          <SubmitButton
            name="intent"
            value="withdraw"
            variant="secondary"
            pendingText="Withdrawing…"
          >
            Withdraw from review
          </SubmitButton>
        </Form>
      )}
      {(status === 'draft' || status === 'rejected' || status === 'published') && (
        <Form
          method="post"
          onSubmit={(e) => {
            if (!confirm('Archive this course? It will be hidden from the catalog.'))
              e.preventDefault();
          }}
        >
          <SubmitButton name="intent" value="archive" variant="ghost" pendingText="Archiving…">
            Archive
          </SubmitButton>
        </Form>
      )}
    </div>
  );
}

function StatusBanner({ course }: { course: EditorCourse }) {
  switch (course.status) {
    case 'in_review':
      return (
        <Alert>
          This course is waiting for review, so editing is paused. Withdraw it if you need to make
          changes.
        </Alert>
      );
    case 'rejected':
      return (
        <Alert tone="danger">
          <p className="font-medium">The reviewer asked for changes.</p>
          {course.reviewNotes && <p className="mt-1">{course.reviewNotes}</p>}
          <p className="mt-1">Make the changes, then submit again.</p>
        </Alert>
      );
    case 'published':
      return (
        <Alert tone="success">
          This course is live. Changes you save appear to learners straight away.
        </Alert>
      );
    case 'archived':
      return <Alert>This course is archived and hidden from the catalog.</Alert>;
    default:
      return null;
  }
}

/** Errors for a field, including list items like "learningOutcomes.2". */
function errorsFor(errors: FieldErrors | undefined, key: string): string[] | undefined {
  if (!errors) return undefined;
  const found = Object.entries(errors)
    .filter(([k]) => k === key || k.startsWith(`${key}.`))
    .flatMap(([, v]) => v);
  return found.length ? [...new Set(found)] : undefined;
}

function DetailsCard({
  course,
  categories,
  locked,
  state,
}: {
  course: EditorCourse;
  categories: Category[];
  locked: boolean;
  state: ActionState | undefined;
}) {
  const errors = state?.fieldErrors;
  const v = (key: (typeof DETAIL_FIELDS)[number], fallback: string) =>
    state?.values?.[key] ?? fallback;

  return (
    <Card>
      <h2 className="text-xl font-semibold">Course details</h2>
      <p className="mt-1 text-sm text-fg-muted">What learners see on the course page.</p>
      {/* Re-mount after each save so inputs show what the server stored (e.g. normalised tags). */}
      <Form key={course.updatedAt} method="post" className="mt-6" noValidate>
        <fieldset disabled={locked} className="space-y-5">
          {state?.formError && <Alert tone="danger">{state.formError}</Alert>}
          <Field label="Title" name="title" errors={errors?.title}>
            {(p) => <Input {...p} maxLength={120} defaultValue={v('title', course.title)} />}
          </Field>
          <Field
            label="Subtitle"
            name="subtitle"
            hint="One sentence that sells the course (10–160 characters)."
            errors={errors?.subtitle}
          >
            {(p) => <Input {...p} maxLength={160} defaultValue={v('subtitle', course.subtitle)} />}
          </Field>
          <Field
            label="Description"
            name="description"
            hint="Who it's for, what's inside, and why you. At least 200 characters. Markdown is supported."
            errors={errors?.description}
          >
            {(p) => (
              <textarea
                {...p}
                rows={8}
                maxLength={20000}
                className={inputClass}
                defaultValue={v('description', course.description)}
              />
            )}
          </Field>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Category" name="categoryId" errors={errors?.categoryId}>
              {(p) => (
                <select
                  {...p}
                  className={inputClass}
                  defaultValue={v('categoryId', course.categoryId ?? '')}
                >
                  <option value="">Choose…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Level" name="level" errors={errors?.level}>
              {(p) => (
                <select {...p} className={inputClass} defaultValue={v('level', course.level)}>
                  {COURSE_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {LEVEL_LABELS[l]}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Language" name="language" errors={errors?.language}>
              {(p) => (
                <select {...p} className={inputClass} defaultValue={v('language', course.language)}>
                  {Object.entries(COURSE_LANGUAGES).map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <Field
            label="Price (₹)"
            name="price"
            hint="0 for a free course, or a whole-rupee amount from ₹199 to ₹4,999."
            errors={errorsFor(errors, 'priceInPaise') ?? errors?.price}
          >
            {(p) => (
              <Input
                {...p}
                inputMode="numeric"
                className="sm:max-w-40"
                defaultValue={v('price', String(course.priceInPaise / 100))}
              />
            )}
          </Field>
          <Field
            label="What learners will learn"
            name="learningOutcomes"
            hint="One per line. At least 3, up to 12."
            errors={errorsFor(errors, 'learningOutcomes')}
          >
            {(p) => (
              <textarea
                {...p}
                rows={5}
                className={inputClass}
                defaultValue={v('learningOutcomes', course.learningOutcomes.join('\n'))}
              />
            )}
          </Field>
          <Field
            label="Requirements (optional)"
            name="requirements"
            hint="One per line, e.g. “A laptop with Excel installed”."
            errors={errorsFor(errors, 'requirements')}
          >
            {(p) => (
              <textarea
                {...p}
                rows={3}
                className={inputClass}
                defaultValue={v('requirements', course.requirements.join('\n'))}
              />
            )}
          </Field>
          <Field
            label="Tags (optional)"
            name="tags"
            hint="Comma-separated, up to 10. Helps people find the course."
            errors={errorsFor(errors, 'tags')}
          >
            {(p) => <Input {...p} defaultValue={v('tags', course.tags.join(', '))} />}
          </Field>
          <div className="flex justify-end">
            <SubmitButton name="intent" value="details" pendingText="Saving…">
              Save details
            </SubmitButton>
          </div>
        </fieldset>
      </Form>
    </Card>
  );
}

function MoveButtons({
  intent,
  hidden,
  first,
  last,
  label,
}: {
  intent: string;
  hidden: Record<string, string>;
  first: boolean;
  last: boolean;
  label: string;
}) {
  return (
    <Form method="post" className="flex">
      <input type="hidden" name="intent" value={intent} />
      {Object.entries(hidden).map(([k, val]) => (
        <input key={k} type="hidden" name={k} value={val} />
      ))}
      <Button
        type="submit"
        name="direction"
        value="up"
        variant="ghost"
        size="icon"
        disabled={first}
        aria-label={`Move ${label} up`}
        className="size-8"
      >
        <ArrowUp aria-hidden="true" />
      </Button>
      <Button
        type="submit"
        name="direction"
        value="down"
        variant="ghost"
        size="icon"
        disabled={last}
        aria-label={`Move ${label} down`}
        className="size-8"
      >
        <ArrowDown aria-hidden="true" />
      </Button>
    </Form>
  );
}

function DeleteButton({
  intent,
  hidden,
  label,
  question,
}: {
  intent: string;
  hidden: Record<string, string>;
  label: string;
  question: string;
}) {
  return (
    <Form
      method="post"
      onSubmit={(e) => {
        if (!confirm(question)) e.preventDefault();
      }}
    >
      <input type="hidden" name="intent" value={intent} />
      {Object.entries(hidden).map(([k, val]) => (
        <input key={k} type="hidden" name={k} value={val} />
      ))}
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        aria-label={label}
        className="size-8 hover:text-danger"
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </Form>
  );
}

function CurriculumCard({
  course,
  locked,
  state,
}: {
  course: EditorCourse;
  locked: boolean;
  state: ActionState | undefined;
}) {
  return (
    <Card>
      <h2 className="text-xl font-semibold">Curriculum</h2>
      <p className="mt-1 text-sm text-fg-muted">
        Group lessons into sections. Open a lesson to add its video or text.
      </p>
      <fieldset disabled={locked} className="mt-6 space-y-4">
        {course.sections.map((section, i) => (
          <SectionBlock
            key={section.id}
            courseId={course.id}
            section={section}
            index={i}
            count={course.sections.length}
            state={state}
          />
        ))}

        <Form
          method="post"
          className="flex flex-col gap-3 rounded-lg border border-dashed border-border-strong p-4 sm:flex-row sm:items-start"
          noValidate
        >
          <div className="flex-1">
            <Field
              label="New section"
              name="title"
              errors={state?.intent === 'add-section' ? state.fieldErrors?.title : undefined}
            >
              {(p) => <Input {...p} maxLength={120} placeholder="e.g. Getting started" />}
            </Field>
          </div>
          <SubmitButton
            variant="secondary"
            pendingText="Adding…"
            className="sm:mt-7"
            name="intent"
            value="add-section"
          >
            <Plus aria-hidden="true" /> Add section
          </SubmitButton>
        </Form>
      </fieldset>
    </Card>
  );
}

function SectionBlock({
  courseId,
  section,
  index,
  count,
  state,
}: {
  courseId: string;
  section: EditorSection;
  index: number;
  count: number;
  state: ActionState | undefined;
}) {
  const addLessonErrors =
    state?.intent === 'add-lesson' && state.values?.sectionId === section.id
      ? state.fieldErrors
      : undefined;

  return (
    <div className="rounded-lg border border-border">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-bg-subtle px-3 py-2">
        <span className="text-xs font-semibold text-fg-subtle uppercase">Section {index + 1}</span>
        <Form method="post" className="flex min-w-0 flex-1 items-center gap-2">
          <input type="hidden" name="intent" value="rename-section" />
          <input type="hidden" name="sectionId" value={section.id} />
          <label htmlFor={`section-${section.id}`} className="sr-only">
            Section title
          </label>
          <Input
            id={`section-${section.id}`}
            name="title"
            defaultValue={section.title}
            maxLength={120}
            className="h-8 min-w-0 flex-1 font-medium"
          />
          <Button type="submit" variant="ghost" size="sm">
            Rename
          </Button>
        </Form>
        <MoveButtons
          intent="move-section"
          hidden={{ sectionId: section.id }}
          first={index === 0}
          last={index === count - 1}
          label={`section ${section.title}`}
        />
        <DeleteButton
          intent="delete-section"
          hidden={{ sectionId: section.id }}
          label={`Delete section ${section.title}`}
          question={`Delete "${section.title}" and its ${section.lessons.length} lesson(s)?`}
        />
      </div>

      <ul className="divide-y divide-border">
        {section.lessons.length === 0 && (
          <li className="px-4 py-3 text-sm text-fg-subtle">No lessons yet.</li>
        )}
        {section.lessons.map((lesson, i) => {
          const Icon = lesson.type === 'video' ? PlayCircle : FileText;
          const incomplete =
            (lesson.type === 'video' && !lesson.video) ||
            (lesson.type === 'article' && lesson.contentMarkdown.trim().length < 50);
          return (
            <li key={lesson.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <Icon className="size-4 shrink-0 text-fg-subtle" aria-hidden="true" />
              <Link
                to={`/studio/courses/${courseId}/lessons/${lesson.id}`}
                className="min-w-0 flex-1 truncate text-sm font-medium hover:text-brand"
              >
                {lesson.title}
              </Link>
              {lesson.isPreview && <Badge tone="brand">Free preview</Badge>}
              {incomplete && <Badge tone="danger">Needs content</Badge>}
              {lesson.durationMinutes > 0 && (
                <span className="text-xs text-fg-subtle">
                  {durationLabel(lesson.durationMinutes)}
                </span>
              )}
              <MoveButtons
                intent="move-lesson"
                hidden={{ sectionId: section.id, lessonId: lesson.id }}
                first={i === 0}
                last={i === section.lessons.length - 1}
                label={`lesson ${lesson.title}`}
              />
              <DeleteButton
                intent="delete-lesson"
                hidden={{ lessonId: lesson.id }}
                label={`Delete lesson ${lesson.title}`}
                question={`Delete the lesson "${lesson.title}"?`}
              />
            </li>
          );
        })}
      </ul>

      <Form
        method="post"
        className="flex flex-col gap-2 border-t border-border p-3 sm:flex-row sm:items-start"
        noValidate
      >
        <input type="hidden" name="intent" value="add-lesson" />
        <input type="hidden" name="sectionId" value={section.id} />
        <div className="flex-1">
          <label htmlFor={`new-lesson-${section.id}`} className="sr-only">
            New lesson title
          </label>
          <Input
            id={`new-lesson-${section.id}`}
            name="title"
            maxLength={160}
            placeholder="New lesson title"
            aria-invalid={Boolean(addLessonErrors?.title)}
            className="h-9"
          />
          {addLessonErrors?.title && (
            <p className="mt-1 text-xs text-danger" role="alert">
              {addLessonErrors.title.join(' ')}
            </p>
          )}
        </div>
        <label htmlFor={`new-lesson-type-${section.id}`} className="sr-only">
          Lesson type
        </label>
        <select
          id={`new-lesson-type-${section.id}`}
          name="type"
          className={`${inputClass} h-9 sm:w-32`}
          defaultValue="video"
        >
          <option value="video">Video</option>
          <option value="article">Article</option>
        </select>
        <Button type="submit" variant="secondary" size="sm" className="h-9">
          <Plus aria-hidden="true" /> Add lesson
        </Button>
      </Form>
    </div>
  );
}

function ChecklistCard({
  checklist,
  status,
}: {
  checklist: string[];
  status: EditorCourse['status'];
}) {
  const ready = checklist.length === 0;
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-base font-semibold">Ready for review?</h2>
      {ready ? (
        <p className="mt-2 flex items-start gap-2 text-sm text-fg-muted">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          {status === 'draft' || status === 'rejected'
            ? 'Everything required is in place. Submit when you are happy with it.'
            : 'Everything required is in place.'}
        </p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {checklist.map((item) => (
            <li key={item} className="flex items-start gap-2 text-fg-muted">
              <Circle className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-fg-subtle">
        Reviewers also check that content is original, accurate and matches the description.
      </p>
    </Card>
  );
}
