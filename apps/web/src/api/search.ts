import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/client';
import type { SearchResponse } from '@/api/types';

export const searchKeys = {
  all: ['search'] as const,
  query: (q: string, types?: string) => [...searchKeys.all, q, types] as const,
};

export function useSearch(query: string, types?: string, limit?: number) {
  return useQuery({
    queryKey: searchKeys.query(query, types),
    queryFn: async () => {
      const { data } = await apiClient.get<SearchResponse>('/search', {
        params: { q: query, ...(types && { types }), ...(limit && { limit }) },
      });
      return data;
    },
    enabled: query.trim().length > 0,
    staleTime: 5_000,
  });
}
