/**
 * Form helpers shared by every action.
 *
 * Pattern used by each form route:
 *   1. `formValues(formData, [...fields])` → plain object of strings
 *   2. validate with the SAME Zod schema the API uses (`@skillverse/shared`)
 *   3. if invalid → return `formError(...)` (HTTP 400, errors shown next to fields)
 *   4. call the API; if it refuses → `fromApiError(...)` maps its errors onto fields
 *
 * Values are echoed back so the user doesn't retype everything, EXCEPT fields
 * listed in `SECRET_FIELDS`, which are never sent back to the browser.
 */
import { data } from 'react-router';
import type { z } from 'zod';

export type FieldErrors = Record<string, string[]>;

export interface FormState {
  fieldErrors?: FieldErrors;
  formError?: string;
  values?: Record<string, string>;
  success?: string;
}

const SECRET_FIELDS = new Set(['password', 'currentPassword', 'newPassword', 'token']);

/** Reads named text fields from FormData (missing → ''). Files and duplicates are ignored. */
export function formValues<K extends string>(
  formData: FormData,
  fields: readonly K[],
): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const field of fields) {
    const value = formData.get(field);
    out[field] = typeof value === 'string' ? value : '';
  }
  return out;
}

function publicValues(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).filter(([k]) => !SECRET_FIELDS.has(k)));
}

/** Validates with a Zod schema. Returns the parsed data, or field errors keyed by field name. */
export function validate<S extends z.ZodType>(
  schema: S,
  input: unknown,
): { ok: true; data: z.infer<S> } | { ok: false; fieldErrors: FieldErrors } {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const fieldErrors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_form';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { ok: false, fieldErrors };
}

/** A 400 response carrying errors and the (non-secret) submitted values. */
export function formError(
  state: Omit<FormState, 'values'> & { values?: Record<string, string> },
  status = 400,
) {
  return data<FormState>(
    { ...state, values: state.values ? publicValues(state.values) : undefined },
    { status },
  );
}

/** Converts an API error body into a form state (field errors when the API gave them). */
export function fromApiError(
  error: { message: string; fields?: FieldErrors },
  status: number,
  values?: Record<string, string>,
) {
  return formError(
    { fieldErrors: error.fields, formError: error.fields ? undefined : error.message, values },
    status,
  );
}
