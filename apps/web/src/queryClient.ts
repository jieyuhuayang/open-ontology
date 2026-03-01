import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import type { Mutation } from '@tanstack/react-query';
import { message } from 'antd';
import type { AxiosError } from 'axios';

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

function extractErrorMessage(error: unknown): string {
  const axiosErr = error as AxiosError<ApiErrorBody>;
  const serverMessage = axiosErr.response?.data?.error?.message;
  if (serverMessage) return serverMessage;
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}

function handleGlobalError(error: unknown) {
  message.error(extractErrorMessage(error));
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
