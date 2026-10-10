# Website redesign

## Brief and direction

Redesign every website surface while preserving route loaders, actions, permissions, forms, API contracts and the light/dark/system theme cookie. Show existing API content and useful empty states; do not invent people, reviews, testimonials, enrollments or activity.

The direction is a **learning studio**: generous reading space, a quiet mineral palette, an expressive skill diagram in the hero, and organized workspaces for learning, teaching and moderation.

## Design plan

- Palette: porcelain `#f7f9fc`, white `#ffffff`, ink `#202d40`, slate `#536279`, harbor blue `#345c8c`, pale blue `#e8eef7`. Dark uses navy `#141c28`, slate surfaces `#1c2736`, soft text `#e6edf6` and desaturated blue `#a5c2e6`.
- Type: self-hosted Manrope for navigation, forms and reading; Bricolage Grotesque for expressive headings. Left-aligned headings and body text; paragraphs capped near 70 characters.
- Layout: a split hero pairs a large heading and working course search with a connected diagram of supported learning activities. Course discovery uses a search surface, category rail and a quiet filter panel. Signed-in workspaces use a shared side navigation that becomes horizontal on mobile.
- Motion: one scroll-linked hero composition and an animated scroll cue; menus and disclosures animate in response to input. Reduced motion disables parallax and the cue. All hero content remains visible without animation or JavaScript.
- Hero follow-up: a bordered Scroll down cue with a moving wheel/arrow, a scroll-traced orbit and outward-moving nodes make the interaction clearer. Cue animation ends after three cycles (under five seconds); reduced motion leaves a static diagram and native discovery link.
- Components: React Router stays in place. Radix supplies keyboard/focus behavior for enhanced account menus and FAQ disclosures; native navigation fallbacks and native form controls preserve progressive enhancement. Locally owned shadcn-style components unify buttons, fields, cards and badges. Motion handles the hero.

```text
Home:       [ navigation                                      ]
            [ headline + search       connected skill diagram ]
            [ real courses / explicit empty state             ]
            [ learning process        teaching invitation     ]
            [ future capabilities     questions               ]

Workspace:  [ navigation                                      ]
            [ side navigation | heading + real page content   ]
```

## Review against the brief

The hero is a subject-specific diagram, rather than a dashboard filled with invented activity. The visual emphasis belongs to the headline and skill connections; supporting pages stay restrained. Future mentoring and swaps are explicitly marked as planned. Decorative marks are not presented as course thumbnails, real people or usage data. A single primitive family keeps focus behavior and styling consistent across the site.

## Verification

Run existing lint, types, unit tests and all browser journeys. Inspect screenshots at desktop and mobile sizes in both themes; check keyboard navigation, real empty states, reduced motion, horizontal overflow, hydration/browser errors and WCAG AA checks. Build the SSR website before committing and pushing to `v2` as `Kanavt15`, without co-authors.

After the video-learning and hero follow-up, the production build's static initial homepage JavaScript graph (entry, root, home and their imported chunks) measures **178,059 bytes gzip**, below the 180 KB budget. The enhanced account menu is excluded; fonts and CSS are measured separately. At redesign commit `319e074`, all 26 loaders/actions in changed non-landing route files were compared against the prior commit and remained unchanged. The video-learning follow-up extends the Studio lesson action to validate and save authored timeline fields; existing lesson permissions and completion actions remain intact.
