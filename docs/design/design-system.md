# Design system

SkillVerse uses a quiet **learning studio** direction: mineral surfaces, desaturated harbor blue, expressive headings and generous reading space. The hero's connected skill diagram is the main visual statement. Supporting pages organize real learning, teaching and moderation work.

Source of truth: [app.css](../../apps/web/app/styles/app.css) for tokens and [redesign.css](../../apps/web/app/styles/redesign.css) for layouts. See the [redesign brief](redesign.md) and [ADR 0008](../architecture/adr/0008-website-design-system.md).

## Tokens

Use semantic Tailwind utilities such as `bg-surface`, `text-fg-muted` and `border-border`; do not put raw brand colors in components.

| Token             | Light     | Dark      | Purpose                              |
| ----------------- | --------- | --------- | ------------------------------------ |
| `bg`              | `#f7f9fc` | `#141c28` | Page background                      |
| `bg-subtle`       | `#eef2f7` | `#172130` | Alternate surfaces                   |
| `surface`         | `#ffffff` | `#1c2736` | Forms, cards and menus               |
| `surface-muted`   | `#edf1f6` | `#253245` | Hover states, code and illustrations |
| `fg`              | `#202d40` | `#e6edf6` | Primary text                         |
| `fg-muted`        | `#536279` | `#afbed1` | Secondary text                       |
| `fg-subtle`       | `#5a697d` | `#9cacc1` | Captions                             |
| `border`          | `#dce3ec` | `#344255` | Panel outlines                       |
| `border-strong`   | `#bac6d6` | `#4e6077` | Control outlines                     |
| `brand`           | `#345c8c` | `#a5c2e6` | Actions, links and focus             |
| `brand-fg`        | `#ffffff` | `#141c28` | Primary button text                  |
| `brand-subtle`    | `#e8eef7` | `#25364d` | Selections and illustrations         |
| `brand-subtle-fg` | `#345580` | `#bcd0eb` | Selected text                        |
| `accent`          | `#326b62` | `#a2c9bd` | Progress and completion              |
| `accent-subtle`   | `#e7f1ee` | `#223a37` | Completion surfaces                  |

Success, warning and danger are reserved for status. Danger buttons use `danger-fg` so text remains legible in both themes. Body text pairs are checked with Playwright/axe against WCAG AA.

## Theme and typography

The OS determines the default theme. The header still cycles system, light and dark; the `sv_theme` cookie is rendered into the server document to avoid a theme flash.

Manrope is the self-hosted variable UI/body font. Bricolage Grotesque is the self-hosted display font. No third-party font requests are needed. The hero uses a responsive 48–88 px heading; normal page headings use 32–52 px and body text uses 14–18 px. Keep reading text near 70 characters per line.

## Layout and components

Content is capped at 1280 px with 32 px desktop and 20 px mobile gutters. Forms, reading panels and menus have distinct hierarchy. Controls have 12 px radii; panels use 18–24 px. Card shadows are subtle; most structure comes from spacing and surface changes.

| Component                                            | Role                                                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `Button`, `Input`, `Field`, `Card`, `Badge`, `Alert` | Locally owned components with semantic tokens; existing names, values, validation and pending states remain intact |
| `SiteHeader`, `SiteFooter`, `Logo`                   | Responsive site navigation and shared brand                                                                        |
| `AccountMenu`                                        | Radix keyboard/focus management, loaded for signed-in viewers after hydration; native disclosure fallback          |
| `WorkspaceShell`, `LearnerWorkspace`                 | Sidebar navigation on desktop, horizontal navigation on mobile; route loaders still authorize access               |
| `AuthShell`                                          | Quiet learning illustration beside the existing forms; compact card on mobile                                      |
| `Hero`                                               | Working GET search, conceptual skill diagram, scroll-linked Motion animation and scroll cue                        |
| `FAQ`                                                | Radix Accordion with native no-JavaScript disclosures                                                              |
| `CourseCard`, `LearningShelf`                        | Existing API course fields, learner progress and certificate links                                                 |
| `PageHeading`                                        | Shared page heading rhythm                                                                                         |

The account menu must keep the sign-out form mounted until submission. Prevent Radix's selection-driven close for that item; retain the POST form rather than turning sign-out into a GET link.

## Content and motion

Never invent users, ratings, testimonials, course covers or usage totals. Subject illustrations are decorative. Dashboard totals are derived from the loaded enrollments. Show an actionable empty state when data is absent, and distinguish a temporarily unavailable catalog from an empty one.

Mentoring, skill swaps and paid enrollment are described as planned. Completion certificates are not described as proctored qualifications.

The hero is the single scroll-responsive composition. Reduced motion disables its transform and animated cue. All page content is visible before JavaScript runs. Menus and FAQs respond to deliberate user actions; there are no automatic card entrance sequences.

## Verification and performance

Keep the existing marketing budget of less than 180 KB initial JavaScript gzip. Account-menu code is deferred for signed-out visitors, and Motion uses its small `scroll` API with one transform-update callback. Fonts load from the same origin.

The browser suite checks both themes, desktop/mobile layouts, horizontal overflow, WCAG AA, keyboard focus, reduced motion and no-JavaScript navigation. Existing authentication, learning, community and quiz journeys cover behavior preservation. Screenshots are written to the ignored `apps/web/test-results/` directory. LCP, CLS and INP still require a representative production measurement.

Development explicitly pre-bundles the lazy UI and Markdown dependencies. Their first appearance must not trigger Vite's optimization reload during an authentication redirect or form submission.
