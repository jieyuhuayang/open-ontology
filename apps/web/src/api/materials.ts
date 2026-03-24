import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import type { AgentMaterial } from '@/api/types';

export const materialKeys = {
  all: ['materials'] as const,
  lists: () => [...materialKeys.all, 'list'] as const,
  list: (sessionRid: string) =>
    [...materialKeys.lists(), sessionRid] as const,
  details: () => [...materialKeys.all, 'detail'] as const,
  detail: (rid: string) => [...materialKeys.details(), rid] as const,
};

export function useMaterials(sessionRid: string) {
  return useQuery({
    queryKey: materialKeys.list(sessionRid),
    queryFn: async () => {
      const { data } = await apiClient.get<AgentMaterial[]>(
        '/agent/materials/',
        {
          params: { sessionRid },
        },
      );
      return data;
    },
    enabled: !!sessionRid,
  });
}

export function useUploadMaterial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      sessionRid,
    }: {
      file: File;
      sessionRid: string;
    }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('session_rid', sessionRid);
      const { data } = await apiClient.post<AgentMaterial>(
        '/agent/materials/upload',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        },
      );
      return data;
    },
    meta: { skipGlobalError: true },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: materialKeys.list(variables.sessionRid),
      });
    },
  });
}

export function useDeleteMaterial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rid: string) => {
      await apiClient.delete(`/agent/materials/${rid}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: materialKeys.lists() });
    },
  });
}
