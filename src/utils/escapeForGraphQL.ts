import type { Address } from 'viem';

// Addresses today come from viem/wagmi and are well-formed hex, but the
// GraphQL builders interpolate them straight into a quoted literal, so
// any future caller passing an unvalidated string could break out of the
// literal and rewrite the query. Escape the only character that ends the
// literal; behavior for well-formed addresses is unchanged.
export const escapeForGraphQL = (address: Address): string =>
  address.toLowerCase().replace(/"/g, '\\"');
