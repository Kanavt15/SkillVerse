# components/

| Folder    | What goes in it                                                                                                                     |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `ui/`     | Generic, reusable building blocks with no business knowledge (Button, Badge, later Input, Dialog…). Styled only with design tokens. |
| `layout/` | Page chrome shared by many pages: header, footer, logo, theme toggle.                                                               |

Feature-specific components (e.g. `CourseCard`) will live in `app/features/<feature>/` once features exist, next to the feature's other code.

Rules: every component file has a header comment; interactive components are keyboard-accessible and labelled; see [docs/design/design-system.md](../../../../docs/design/design-system.md).
