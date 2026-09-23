# Guide: add a page

We'll add an **About** page at `/about`. Reference: [`apps/web/app/routes/home.tsx`](../../apps/web/app/routes/home.tsx).

## 1. Register the URL

In [`apps/web/app/routes.ts`](../../apps/web/app/routes.ts), add the route **above** the catch-all `*` route:

```ts
import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('about', 'routes/about.tsx'),
  route('*', 'routes/not-found.tsx'), // keep last
] satisfies RouteConfig;
```

Dynamic segments look like `route('courses/:slug', 'routes/course-detail.tsx')`.

## 2. Create the route module

```tsx
// apps/web/app/routes/about.tsx
/** About page (/about): who we are and why SkillVerse exists. */
import type { Route } from './+types/about';
import { apiGet } from '~/lib/api.server';

// SEO: every page sets a unique title and description.
export function meta(_: Route.MetaArgs) {
  return [
    { title: 'About | SkillVerse' },
    { name: 'description', content: 'Why we are building SkillVerse.' },
  ];
}

// Runs on the SERVER before rendering. Its return value is sent to the browser.
export async function loader(_: Route.LoaderArgs) {
  const stats = await apiGet<{ learners: number }>('/api/v1/stats'); // example
  return { learners: stats.learners };
}

export default function About({ loaderData }: Route.ComponentProps) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-bold">About SkillVerse</h1>
      <p className="mt-4 text-fg-muted">{loaderData.learners} learners and counting.</p>
    </section>
  );
}
```

`./+types/about` is generated automatically by React Router (`npm run typecheck` or the dev server creates it). It gives you typed `loaderData` and `params`.

## 3. Data rules

- **Loaders run on the server.** Use `apiGet` from `~/lib/api.server`, which calls the API Worker through the service binding.
- **Anything a loader returns is visible in the browser.** Never return secrets or other users' private data.
- Forms that change data use an `action` function (introduced with auth in Phase 1).
- If data is optional (e.g. a sidebar widget), `try/catch` the call so the page still renders when the API has a problem, as `root.tsx` does.

## 4. UI rules

- Build from components in `app/components/ui/` and use design tokens (`bg-surface`, `text-fg-muted`, `border-border`). See [design-system.md](../design/design-system.md).
- Page structure: one `<h1>`, then `<h2>`/`<h3>` in order. Wrap sections in `<section aria-labelledby=…>` where it helps.
- Check the page at phone width (375 px) and in both themes.
- Pages that shouldn't be indexed (account and admin pages) add `{ name: 'robots', content: 'noindex' }` in `meta`.

## 5. Link to it

Use `<Link to="/about">` or `<Button asLink to="/about">`, never a plain `<a>` for internal pages (so navigation stays client-side and fast).

## 6. Test and document

- Unit-test any non-trivial logic you extracted into `app/lib/`.
- Add the page to [information-architecture.md](../design/information-architecture.md) and to the CHANGELOG.
