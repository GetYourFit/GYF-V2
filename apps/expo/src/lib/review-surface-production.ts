// Metro resolves review modules to this inert production replacement. The local
// route still imports its review graph in development, while release bundles do
// not carry fixture IDs or illustrative design-review assets.
export const CoreRouteReview = () => null;
export const CORE_ROUTE_REVIEW_FIXTURES: readonly [] = [];
