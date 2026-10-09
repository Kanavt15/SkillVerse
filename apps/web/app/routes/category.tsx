/** /categories/:slug: server-rendered topic catalog using the same search filters. */
import type { Route } from './+types/category';
import { CatalogView } from '~/features/learning/catalog-view';
import { loadCatalog } from '~/features/learning/catalog.server';

export function meta({ data }: Route.MetaArgs) {
  return [
    { title: `${data?.category?.name ?? 'Category'} courses | SkillVerse` },
    {
      name: 'description',
      content: data?.category?.description ?? 'Discover a new skill on SkillVerse.',
    },
  ];
}
export function loader({ request, params }: Route.LoaderArgs) {
  return loadCatalog(request, params.slug);
}
export default function Category({ loaderData }: Route.ComponentProps) {
  return <CatalogView {...loaderData} />;
}
