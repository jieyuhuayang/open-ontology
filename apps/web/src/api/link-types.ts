import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import type {
  LinkType,
  LinkTypeCreateRequest,
  LinkTypeUpdateRequest,
  LinkTypeListResponse,
} from '@/api/types';

export const linkTypeKeys = {
  all: ['link-types'] as const,
  lists: () => [...linkTypeKeys.all, 'list'] as const,
  list: (params: {
    page: number;
    pageSize: number;
    objectTypeRid?: string;
    status?: string;
    visibility?: string;
  }) => [...linkTypeKeys.lists(), params] as const,
  details: () => [...linkTypeKeys.all, 'detail'] as const,
  detail: (rid: string) => [...linkTypeKeys.details(), rid] as const,
};

export function useLinkTypes(
  page: number,
  pageSize: number,
  filters?: { objectTypeRid?: string; status?: string; visibility?: string },
) {
  return useQuery({
    queryKey: linkTypeKeys.list({
      page,
      pageSize,
      ...filters,
    }),
    queryFn: async () => {
      const { data } = await apiClient.get<LinkTypeListResponse>('/link-types', {
        params: { page, pageSize, ...filters },
      });
      return data;
    },
  });
}

export function useLinkType(rid: string) {
  return useQuery({
    queryKey: linkTypeKeys.detail(rid),
    queryFn: async () => {
      const { data } = await apiClient.get<LinkType>(`/link-types/${rid}`);
      return data;
    },
    enabled: !!rid,
  });
}

export function useCreateLinkType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: LinkTypeCreateRequest) => {
      const { data } = await apiClient.post<LinkType>('/link-types', req);
      return data;
    },
    meta: { skipGlobalError: true },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: linkTypeKeys.lists() });
      queryClient.setQueryData(linkTypeKeys.detail(data.rid), data);
    },
  });
}

export function useUpdateLinkType(rid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: LinkTypeUpdateRequest) => {
      const { data } = await apiClient.put<LinkType>(`/link-types/${rid}`, req);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: linkTypeKeys.lists() });
      queryClient.invalidateQueries({ queryKey: linkTypeKeys.detail(rid) });
    },
  });
}

export function useDeleteLinkType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rid: string) => {
      await apiClient.delete(`/link-types/${rid}`);
    },
    meta: { skipGlobalError: true },
    onSuccess: (_data, rid) => {
      queryClient.invalidateQueries({ queryKey: linkTypeKeys.lists() });
      queryClient.removeQueries({ queryKey: linkTypeKeys.detail(rid) });
    },
  });
}
