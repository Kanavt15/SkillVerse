# ADR 0008: A shared React design system with Radix and Motion

- Status: Accepted
- Date: 2026-10-09

## Context

The website needs a complete visual redesign with restrained light and dark themes, an attractive scroll-responsive hero and no fabricated content. Authentication, enrollment, lessons, quizzes, discussions, moderation, certificates and teaching must retain their current behavior.

## Decision

Keep React 19 and React Router SSR, and rebuild the visual shell and shared components around semantic design tokens. Use Radix Dropdown Menu and Accordion for focus-managed interactions, locally owned shadcn-style controls for existing forms, and Motion for one conceptual hero diagram. Self-host Manrope and Bricolage Grotesque.

Use native disclosures before hydration and without JavaScript. Lazy-load the enhanced account menu only for signed-in viewers. Use Motion's small `scroll` API with a single transform-update callback; disable scroll motion when reduced motion is requested.

Retain all existing route actions, API contracts, CSRF/session controls, role checks and the server-rendered theme cookie. Page layouts share responsive workspaces. Real API data drives courses, ratings and progress; absent data yields useful empty states.

## Consequences

- A single primitive family provides consistent keyboard and focus behavior.
- Existing native forms preserve GET search, POST sign-out and current mutations.
- Future features are clearly marked as planned, without invented activity.
- Both themes use the same components and semantic color roles.
- The initial public bundle avoids account-menu interaction code.
- Browser regression checks cover the visual system alongside all existing journeys.

References: [Radix SSR](https://www.radix-ui.com/primitives/docs/guides/server-side-rendering), [Dropdown Menu](https://www.radix-ui.com/primitives/docs/components/dropdown-menu), [Motion scroll](https://motion.dev/docs/scroll).
