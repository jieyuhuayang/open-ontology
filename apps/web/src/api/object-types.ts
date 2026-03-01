import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import type {
  ObjectType,
  ObjectTypeCreateRequest,
  ObjectTypeUpdateRequest,
  ObjectTypeListResponse,
} from '@/api/types';

export const objectTypeKeys = {
  all: ['object-types'] as const,
  lists: () => [...objectTypeKeys.all, 'list'] as const,
  list: (params: { page: number; pageSize: number }) =>
    [...objectTypeKeys.lists(), params] as const,
  details: () => [...objectTypeKeys.all, 'detail'] as const,
  detail: (rid: string) => [...objectTypeKeys.details(), rid] as const,
};

export function useObjectTypes(page: number, pageSize: number) {
  return useQuery({
    queryKey: objectTypeKeys.list({ page, pageSize }),
    queryFn: async () => {
      const { data } = await apiClient.get<ObjectTypeListResponse>('/object-types', {
        params: { page, pageSize },
      });
      return data;
    },
  });
}

export function useObjectType(rid: string) {
  return useQuery({
    queryKey: objectTypeKeys.detail(rid),
    queryFn: async () => {
      const { data } = await apiClient.get<ObjectType>(`/object-types/${rid}`);
      return data;
    },
    enabled: !!rid,
  });
}

export function useCreateObjectType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: ObjectTypeCreateRequest) => {
      const { data } = await apiClient.post<ObjectType>('/object-types', req);
      return data;
    },
    meta: { skipGlobalError: true },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: objectTypeKeys.lists() });
      queryClient.setQueryData(objectTypeKeys.detail(data.rid), data);
    },
  });
}

export function useUpdateObjectType(rid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: ObjectTypeUpdateRequest) => {
      const { data } = await apiClient.put<ObjectType>(`/object-types/${rid}`, req);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: objectTypeKeys.lists() });
      queryClient.invalidateQueries({ queryKey: objectTypeKeys.detail(rid) });
    },
  });
}

export function useDeleteObjectType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rid: string) => {
      await apiClient.delete(`/object-types/${rid}`);
    },
    onSuccess: (_data, rid) => {
      queryClient.invalidateQueries({ queryKey: objectTypeKeys.lists() });
      queryClient.removeQueries({ queryKey: objectTypeKeys.detail(rid) });
    },
  });
}
