import { env } from 'cloudflare:workers';
import { Link } from 'react-router';
import { POLICY_VERSION } from '@skillverse/shared';
import type { Route } from './+types/policies';
import { policies } from '~/features/privacy/policies';
import { PageHeading } from '~/components/layout/page-heading';
export function loader({ request }: Route.LoaderArgs) {
  const key = new URL(request.url).pathname.slice(1),
    policy = policies[key];
  if (!policy) throw new Response('Not Found', { status: 404 });
  const operator = env as typeof env & {
    PUBLIC_OPERATOR_NAME?: string;
    PUBLIC_OPERATOR_COUNTRY?: string;
  };
  return {
    policy,
    operatorName: operator.PUBLIC_OPERATOR_NAME ?? '',
    operatorCountry: operator.PUBLIC_OPERATOR_COUNTRY ?? '',
  };
}
export function meta({ data }: Route.MetaArgs) {
  return [{ title: `${data?.policy.title ?? 'Policy'} | SkillVerse` }];
}
export default function Policy({ loaderData }: Route.ComponentProps) {
  const { policy } = loaderData;
  return (
    <div className="page-shell max-w-3xl">
      <PageHeading title={policy.title} description={policy.intro} />
      <p className="text-sm text-fg-muted">
        {loaderData.operatorName &&
          `Operator: ${loaderData.operatorName}${loaderData.operatorCountry ? ` (${loaderData.operatorCountry})` : ''}. `}
        Agreement version {POLICY_VERSION} · Current free-course service
      </p>
      <div className="mt-8 space-y-8">
        {policy.sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-xl font-semibold">{section.title}</h2>
            <p className="mt-3 text-sm leading-7 text-fg-muted">{section.body}</p>
          </section>
        ))}
      </div>
      <nav
        aria-label="Policies and contact"
        className="mt-10 flex flex-wrap gap-4 border-t border-border pt-6 text-sm"
      >
        {Object.entries(policies).map(([key, value]) => (
          <Link key={key} to={`/${key}`} className="underline">
            {value.title}
          </Link>
        ))}
        <Link to="/contact" className="underline">
          Private Contact and grievances
        </Link>
      </nav>
    </div>
  );
}
