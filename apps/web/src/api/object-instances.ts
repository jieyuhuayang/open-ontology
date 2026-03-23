import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import type {
  ObjectInstanceItem,
  ObjectInstanceListResponse,
  SyncJob,
} from '@/api/types';

export type { ObjectInstanceItem, ObjectInstanceListResponse, SyncJob };

export const instanceKeys = {
  all: ['object-instances'] as const,
  lists: () => [...instanceKeys.all, 'list'] as const,
  list: (otRid: string, params: { page: number; pageSize: number }) =>
    [...instanceKeys.lists(), otRid, params] as const,
  details: () => [...instanceKeys.all, 'detail'] as const,
  detail: (otRid: string, rid: string) => [...instanceKeys.details(), otRid, rid] as const,
  syncStatus: (otRid: string) => [...instanceKeys.all, 'sync-status', otRid] as const,
};

export function useObjectInstances(otRid: string, page: number, pageSize: number) {
  return useQuery({
    queryKey: instanceKeys.list(otRid, { page, pageSize }),
    queryFn: async () => {
      const { data } = await apiClient.get<ObjectInstanceListResponse>(
        `/object-types/${otRid}/instances`,
        { params: { page, pageSize } },
      );
      return data;
    },
    enabled: !!otRid,
  });
}

export function useObjectInstance(otRid: string, rid: string) {
  return useQuery({
    queryKey: instanceKeys.detail(otRid, rid),
    queryFn: async () => {
      const { data } = await apiClient.get<ObjectInstanceItem>(
        `/object-types/${otRid}/instances/${rid}`,
      );
      return data;
    },
    enabled: !!otRid && !!rid,
  });
}

export function useTriggerSync(otRid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<SyncJob>(`/object-types/${otRid}/sync`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: instanceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: instanceKeys.syncStatus(otRid) });
    },
  });
}

export function useSyncStatus(otRid: string) {
  return useQuery({
    queryKey: instanceKeys.syncStatus(otRid),
    queryFn: async () => {
      const { data } = await apiClient.get<SyncJob | null>(
        `/object-types/${otRid}/sync/status`,
      );
      return data;
    },
    enabled: !!otRid,
  });
}
