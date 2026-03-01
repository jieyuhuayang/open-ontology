import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import type { Mutation } from '@tanstack/react-query';
import { message } from 'antd';

function handleGlobalError(error: unknown) {
  const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
  message.error(msg);
  console.error('[API Error]', error);
}

function handleMutationError(
  error: unknown,
  _variables: unknown,
  _context: unknown,
  mutation: Mutation<unknown, unknown, unknown, unknown>,
) {
  if (mutation.meta?.skipGlobalError) return;
  handleGlobalError(error);
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: handleGlobalError,
  }),
  mutationCache: new MutationCache({
    onError: handleMutationError,
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
