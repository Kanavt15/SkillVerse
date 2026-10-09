/** /courses: indexable catalog with shareable search, filters and pagination. */
import type { Route } from './+types/catalog';
import { CatalogView } from '~/features/learning/catalog-view';
import { loadCatalog } from '~/features/learning/catalog.server';

export function meta({ data }: Route.MetaArgs) {
  return [
    { title: `${data?.filters.q ? `Search: ${data.filters.q}` : 'Explore courses'} | SkillVerse` },
    {
      name: 'description',
      content:
        'Learn practical skills from community instructors. Browse free courses by topic, level and language.',
    },
  ];
}
export function loader({ request }: Route.LoaderArgs) {
  return loadCatalog(request);
}
export default function Catalog({ loaderData }: Route.ComponentProps) {
  return <CatalogView {...loaderData} />;
}
