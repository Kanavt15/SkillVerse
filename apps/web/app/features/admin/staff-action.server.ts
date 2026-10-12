/** Remount proof forms after each response so credentials are cleared on failures too. */
import { formError, type FormState } from '~/lib/forms';
export function staffFormError(state: FormState, status = 400) {
  return formError({ ...state, submissionId: crypto.randomUUID() }, status);
}
export function staffApiError(
  error: { message: string; fields?: Record<string, string[]> },
  status: number,
) {
  return staffFormError(
    { fieldErrors: error.fields, formError: error.fields ? undefined : error.message },
    status,
  );
}
