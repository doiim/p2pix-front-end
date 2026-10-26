import { QueryClient } from '@tanstack/vue-query';

/**
 * One client for the whole app. Declared at module scope (rather than inside
 * `main.ts`) so code that runs outside a component setup — route guards,
 * `fetchQuery` calls during route resolution — shares the exact cache the
 * components read from.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: 1,
    },
  },
});
