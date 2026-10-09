# Teaching views

`types.ts` mirrors owner/staff editor contracts. `quiz-editor.tsx` authors single-answer questions with stable IDs; `quiz-form.ts` validates the form structure, reconstructs named fields and preserves incomplete input after errors. Existing questions can be edited without JavaScript; adding and arranging questions needs JavaScript. Answer keys never enter public course or pre-submission player data.

See [teaching architecture](../../../../../docs/architecture/teaching.md) and [quiz architecture](../../../../../docs/architecture/quizzes.md).
