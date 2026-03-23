import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/client';
import type { HistoryListResponse, ChangeRecord } from '@/api/types';
import { DEFAULT_ONTOLOGY_RID } from '@/api/working-state';

export const historyKeys = {
  all: ['history'] as const,
  lists: () => [...historyKeys.all, 'list'] as const,
  list: (params: { ontologyRid: string; page: number; pageSize: number }) =>
    [...historyKeys.lists(), params] as const,
  details: () => [...historyKeys.all, 'detail'] as const,
  detail: (ontologyRid: string, version: number) =>
    [...historyKeys.details(), ontologyRid, version] as const,
};

export function useHistory(
  page: number = 1,
  pageSize: number = 20,
  ontologyRid: string = DEFAULT_ONTOLOGY_RID,
) {
  return useQuery({
    queryKey: historyKeys.list({ ontologyRid, page, pageSize }),
    queryFn: async () => {
      const { data } = await apiClient.get<HistoryListResponse>(
        `/ontologies/${ontologyRid}/history`,
        { params: { page, pageSize } },
      );
      return data;
    },
  });
}

export function useHistoryVersion(
  version: number | null,
  ontologyRid: string = DEFAULT_ONTOLOGY_RID,
) {
  return useQuery({
    queryKey: historyKeys.detail(ontologyRid, version ?? 0),
    queryFn: async () => {
      const { data } = await apiClient.get<ChangeRecord>(
        `/ontologies/${ontologyRid}/history/${version}`,
      );
      return data;
    },
    enabled: version != null,
  });
}
