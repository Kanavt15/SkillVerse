# Learning feature

`catalog-url.ts` validates and builds shareable filters. `catalog.server.ts` loads catalog/categories through the API binding. `catalog-view.tsx` composes search, filters, category navigation, empty results and pagination for catalog/category routes. Tests cover safe URL round-trips and invalid paging/filter input.

See [learning architecture](../../../../../docs/architecture/learning.md) for access rules and certificate behavior.

`quiz.tsx` renders answer-free practice questions and private post-submission feedback/history. The player sends choices to the API; grading and progress updates run on the server. See [quiz architecture](../../../../../docs/architecture/quizzes.md).

`video-learning.tsx` renders saved chapters, searchable timed transcript cues and optional checkpoints. Timestamp links work without JavaScript. Keyboard shortcuts are scoped to a focused navigation bar; checkpoint reflections use the existing private-note action. See [video learning](../../../../../docs/architecture/video-learning.md).
