import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { objectTypeKeys } from '@/api/object-types';
import type {
  BatchOperationResponse,
  Property,
  PropertyBatchDeleteRequest,
  PropertyBatchUpdateRequest,
  PropertyCreateRequest,
  PropertyListAllResponse,
  PropertyListResponse,
  PropertySortOrderRequest,
  PropertyUpdateRequest,
} from '@/api/types';

export const propertyKeys = {
  all: ['properties'] as const,
  allProperties: () => [...propertyKeys.all, 'all'] as const,
  lists: () => [...propertyKeys.all, 'list'] as const,
  list: (objectTypeRid: string) => [...propertyKeys.lists(), objectTypeRid] as const,
  details: () => [...propertyKeys.all, 'detail'] as const,
  detail: (rid: string) => [...propertyKeys.details(), rid] as const,
};

export function useProperties(objectTypeRid: string) {
  return useQuery({
    queryKey: propertyKeys.list(objectTypeRid),
    queryFn: async () => {
      const { data } = await apiClient.get<PropertyListResponse>(
        `/object-types/${objectTypeRid}/properties`,
      );
      return data;
    },
    enabled: !!objectTypeRid,
  });
}

export function useCreateProperty(objectTypeRid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: PropertyCreateRequest) => {
      const { data } = await apiClient.post<Property>(
        `/object-types/${objectTypeRid}/properties`,
        req,
      );
      return data;
    },
    meta: { skipGlobalError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.list(objectTypeRid) });
      queryClient.invalidateQueries({ queryKey: ['working-state'] });
      queryClient.invalidateQueries({ queryKey: ['search'] });
    },
  });
}

export function useUpdateProperty(objectTypeRid: string, rid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: PropertyUpdateRequest) => {
      const { data } = await apiClient.put<Property>(
        `/object-types/${objectTypeRid}/properties/${rid}`,
        req,
      );
      return data;
    },
    meta: { skipGlobalError: true },
    onSuccess: (_data, req) => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.list(objectTypeRid) });
      queryClient.invalidateQueries({ queryKey: ['working-state'] });
      queryClient.invalidateQueries({ queryKey: ['search'] });
      // If PK/TK changed, also invalidate object type to refresh primaryKeyPropertyId/titleKeyPropertyId
      if (req.isPrimaryKey !== undefined || req.isTitleKey !== undefined) {
        queryClient.invalidateQueries({ queryKey: objectTypeKeys.detail(objectTypeRid) });
      }
    },
  });
}

export function useDeleteProperty(objectTypeRid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rid: string) => {
      await apiClient.delete(`/object-types/${objectTypeRid}/properties/${rid}`);
    },
    meta: { skipGlobalError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.list(objectTypeRid) });
    },
  });
}

export async function createPropertyDirect(
  objectTypeRid: string,
  req: PropertyCreateRequest,
): Promise<Property> {
  const { data } = await apiClient.post<Property>(
    `/object-types/${objectTypeRid}/properties`,
    req,
  );
  return data;
}

export async function updatePropertyDirect(
  objectTypeRid: string,
  propertyRid: string,
  req: PropertyUpdateRequest,
): Promise<Property> {
  const { data } = await apiClient.put<Property>(
    `/object-types/${objectTypeRid}/properties/${propertyRid}`,
    req,
  );
  return data;
}

export function useReorderProperties(objectTypeRid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: PropertySortOrderRequest) => {
      await apiClient.put(`/object-types/${objectTypeRid}/properties/sort-order`, req);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.list(objectTypeRid) });
    },
  });
}

export function useAllProperties() {
  return useQuery({
    queryKey: propertyKeys.allProperties(),
    queryFn: async () => {
      const { data } = await apiClient.get<PropertyListAllResponse>('/properties');
      return data;
    },
  });
}

export function useBatchUpdateProperties(objectTypeRid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: PropertyBatchUpdateRequest) => {
      const { data } = await apiClient.patch<BatchOperationResponse>(
        `/object-types/${objectTypeRid}/properties/batch`,
        req,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.list(objectTypeRid) });
      queryClient.invalidateQueries({ queryKey: propertyKeys.allProperties() });
    },
  });
}

export function useBatchDeleteProperties(objectTypeRid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: PropertyBatchDeleteRequest) => {
      const { data } = await apiClient.post<BatchOperationResponse>(
        `/object-types/${objectTypeRid}/properties/batch-delete`,
        req,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.list(objectTypeRid) });
      queryClient.invalidateQueries({ queryKey: propertyKeys.allProperties() });
    },
  });
}
