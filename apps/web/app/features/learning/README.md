# Learning feature

`catalog-url.ts` validates and builds shareable filters. `catalog.server.ts` loads catalog/categories through the API binding. `catalog-view.tsx` composes search, filters, category navigation, empty results and pagination for catalog/category routes. Tests cover safe URL round-trips and invalid paging/filter input.

See [learning architecture](../../../../../docs/architecture/learning.md) for access rules and certificate behavior.
