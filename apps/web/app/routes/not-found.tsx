/**
 * Catch-all route. Throwing a 404 Response makes React Router render the
 * root ErrorBoundary AND send HTTP status 404, which matters for SEO.
 */
export function loader() {
  throw new Response('Not Found', { status: 404 });
}

export default function NotFound() {
  return null;
}
