# Design system

**Direction:** clean, content-first and trustworthy. Think Coursera's clarity with Linear's polish. The violet brand appears in actions and highlights. Reading and learning surfaces stay calm and high-contrast.

Source of truth: [`apps/web/app/styles/app.css`](../../apps/web/app/styles/app.css).

## Tokens

Components use **semantic** tokens, never raw colours. Tailwind utilities are generated from them (`bg-surface`, `text-fg-muted`, `border-border`…).

| Token                         | Light                 | Dark                  | Use                                                      |
| ----------------------------- | --------------------- | --------------------- | -------------------------------------------------------- |
| `bg`                          | `#ffffff`             | `#0b0b12`             | Page background                                          |
| `bg-subtle`                   | `#f6f6fb`             | `#11111b`             | Alternate section background, footer                     |
| `surface`                     | `#ffffff`             | `#15151f`             | Cards, menus, dialogs                                    |
| `surface-muted`               | `#f1f0f8`             | `#1c1c29`             | Hover states, code blocks, inputs                        |
| `fg`                          | `#14131f`             | `#ececf4`             | Primary text                                             |
| `fg-muted`                    | `#55546a`             | `#a6a5ba`             | Secondary text                                           |
| `fg-subtle`                   | `#75748a`             | `#8a899f`             | Captions, metadata                                       |
| `border` / `border-strong`    | `#e4e3ee` / `#cfcde0` | `#262536` / `#37364c` | Dividers / input outlines                                |
| `brand`                       | `#6a46dc`             | `#9c86ff`             | Primary actions, links, focus ring                       |
| `brand-subtle` / `-subtle-fg` | `#efeafe` / `#4a2bb0` | `#211b3d` / `#c9bcff` | Badges, icon tiles, selection                            |
| `accent` / `accent-subtle`    | `#0e8a7a` / `#e2f5f2` | `#3cc6b1` / `#0f2a27` | Progress, success moments, secondary highlights          |
| `success` `warning` `danger`  | green / amber / red   | lighter tints         | Status only. Never the only signal (add an icon or text) |

**Contrast:** body text pairs meet WCAG 2.2 AA (≥ 4.5:1) in both themes. Check new pairs with a contrast checker before adding them.

## Theme

- Default: follow the operating system (`prefers-color-scheme`).
- The user can force light or dark with the header toggle. The choice is stored in the `sv_theme` cookie and rendered by the server as `<html data-theme="…">`, so there is no flash of the wrong theme.
- Prefer tokens over Tailwind's `dark:` variant. Use `dark:` only for one-off tweaks.

## Typography

| Role     | Font                                        | Notes                            |
| -------- | ------------------------------------------- | -------------------------------- |
| UI, body | Inter (variable, self-hosted)               | `font-sans` (default)            |
| Headings | Bricolage Grotesque (variable, self-hosted) | `font-display`, applied to h1–h3 |

Fonts are bundled from npm (`@fontsource-variable/*`), so they're served from our own origin: no Google Fonts request, better privacy and a simpler CSP.

Scale (Tailwind): `text-sm` (14) for UI, `text-base` (16) for body, `text-lg`, `text-xl`, `text-3xl` for section titles, `text-4xl`/`text-6xl` for hero titles.

## Spacing, radius, elevation

- Spacing uses Tailwind's 4 px scale. Page content is capped at `max-w-6xl` with `px-4 sm:px-6` gutters.
- Radius: `rounded-md` (10 px) for controls, `rounded-lg`/`rounded-xl` for cards.
- Shadows: `shadow-card` for resting cards, `shadow-raised` for menus and dialogs.

## Components

| Component             | File                                 | Notes                                                                                                                                         |
| --------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`              | `components/ui/button.tsx`           | Variants `primary`, `secondary`, `ghost`, `danger`; sizes `sm`/`md`/`lg`/`icon`; `asLink` renders a router link. Defaults to `type="button"`. |
| `Badge`               | `components/ui/badge.tsx`            | Tones `neutral`, `brand`, `accent`, `danger`                                                                                                  |
| `SiteHeader`/`Footer` | `components/layout/`                 | Mobile menu uses native `<details>` (works without JS)                                                                                        |
| `ThemeToggle`         | `components/layout/theme-toggle.tsx` | Cycles system → light → dark                                                                                                                  |

Planned (Phase 1): Input, Textarea, Select, Checkbox, Dialog, DropdownMenu, Tabs, Toast, Skeleton, EmptyState, Avatar, CourseCard, RatingStars, ProgressRing, DataTable, Stepper, and `AdSlot` in Phase 2. Built on Radix primitives for accessibility.

## Accessibility rules

- Everything works with the keyboard. Focus is always visible (2 px brand outline).
- Every icon-only button has an `aria-label`. Decorative icons have `aria-hidden="true"`.
- One `<h1>` per page and headings in order.
- A "Skip to content" link is the first focusable element.
- Motion respects `prefers-reduced-motion` (globally reduced in `app.css`).
- Status is never communicated by colour alone.

## Performance budgets

| Metric                        | Budget   | Phase 0 actual                      |
| ----------------------------- | -------- | ----------------------------------- |
| Client JS (gzip, home page)   | < 180 KB | ~146 KB                             |
| Largest Contentful Paint (4G) | < 2.5 s  | measured in Phase 1 (Lighthouse CI) |
| Cumulative Layout Shift       | < 0.05   | measured in Phase 1                 |
