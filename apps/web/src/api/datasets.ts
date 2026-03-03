import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import type { Dataset, DatasetListResponse, DatasetPreviewResponse } from '@/api/types';

export const datasetKeys = {
  all: ['datasets'] as const,
  lists: () => [...datasetKeys.all, 'list'] as const,
  list: (search?: string) => [...datasetKeys.lists(), { search }] as const,
  details: () => [...datasetKeys.all, 'detail'] as const,
  detail: (rid: string) => [...datasetKeys.details(), rid] as const,
  previews: () => [...datasetKeys.all, 'preview'] as const,
  preview: (rid: string, limit?: number) => [...datasetKeys.previews(), rid, { limit }] as const,
};

export function useDatasets(search?: string) {
  return useQuery({
    queryKey: datasetKeys.list(search),
    queryFn: async () => {
      const { data } = await apiClient.get<DatasetListResponse>('/datasets', {
        params: search ? { search } : undefined,
      });
      return data;
    },
  });
}

export function useDataset(rid: string) {
  return useQuery({
    queryKey: datasetKeys.detail(rid),
    queryFn: async () => {
      const { data } = await apiClient.get<Dataset>(`/datasets/${rid}`);
      return data;
    },
    enabled: !!rid,
  });
}

export function useDatasetPreview(rid: string, limit?: number) {
  return useQuery({
    queryKey: datasetKeys.preview(rid, limit),
    queryFn: async () => {
      const { data } = await apiClient.get<DatasetPreviewResponse>(`/datasets/${rid}/preview`, {
        params: limit !== undefined ? { limit } : undefined,
      });
      return data;
    },
    enabled: !!rid,
  });
}

export function useDeleteDataset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rid: string) => {
      await apiClient.delete(`/datasets/${rid}`);
    },
    meta: { skipGlobalError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: datasetKeys.lists() });
    },
  });
}
