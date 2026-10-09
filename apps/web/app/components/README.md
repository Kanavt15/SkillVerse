# components/

| Folder      | What goes in it                                                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `ui/`       | Generic, reusable building blocks with no business knowledge (Button, Badge, later Input, Dialog…). Styled only with design tokens. |
| `layout/`   | Page chrome shared by many pages: header, footer, logo, theme toggle.                                                               |
| `learning/` | Learner components shared across pages: CourseCard and LearningShelf.                                                               |

Feature-specific helpers and page composition live in `app/features/<feature>/`. Learner components reused across home, dashboard and catalog live in `learning/`.

Rules: every component file has a header comment; interactive components are keyboard-accessible and labelled; see [docs/design/design-system.md](../../../../docs/design/design-system.md).
