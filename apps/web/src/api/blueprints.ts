import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import type {
  BlueprintApplyResult,
  BlueprintDetail,
  BlueprintItem,
  BlueprintItemBatchUpdate,
  BlueprintItemRetryResult,
  BlueprintList,
  BlueprintPreApplyCheck,
} from '@/api/types';

export const blueprintKeys = {
  all: ['blueprints'] as const,
  lists: () => [...blueprintKeys.all, 'list'] as const,
  list: (params: { sessionRid?: string; ontologyRid?: string }) =>
    [...blueprintKeys.lists(), params] as const,
  details: () => [...blueprintKeys.all, 'detail'] as const,
  detail: (rid: string) => [...blueprintKeys.details(), rid] as const,
};

export function useBlueprints(params: {
  sessionRid?: string;
  ontologyRid?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: blueprintKeys.list({
      sessionRid: params.sessionRid,
      ontologyRid: params.ontologyRid,
    }),
    queryFn: async () => {
      const { data } = await apiClient.get<BlueprintList>('/blueprints', {
        params: {
          sessionRid: params.sessionRid,
          ontologyRid: params.ontologyRid,
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 20,
        },
      });
      return data;
    },
    enabled: !!(params.sessionRid || params.ontologyRid),
  });
}

export function useBlueprintDetail(rid: string | null) {
  return useQuery({
    queryKey: blueprintKeys.detail(rid ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<BlueprintDetail>(
        `/blueprints/${rid}`,
      );
      return data;
    },
    enabled: !!rid,
  });
}

// --- F017: Mutation hooks ---

export function useUpdateItemDecision(blueprintRid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      itemRid,
      userDecision,
      userEdits,
      rejectionReason,
    }: {
      itemRid: string;
      userDecision: string;
      userEdits?: Record<string, unknown>;
      rejectionReason?: string;
    }) => {
      const { data } = await apiClient.patch<BlueprintItem>(
        `/blueprints/${blueprintRid}/items/${itemRid}`,
        { userDecision, userEdits, rejectionReason },
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: blueprintKeys.detail(blueprintRid),
      });
    },
  });
}

export function useBatchUpdateDecisions(blueprintRid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: BlueprintItemBatchUpdate) => {
      const { data } = await apiClient.patch<BlueprintItem[]>(
        `/blueprints/${blueprintRid}/items/batch-decision`,
        body,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: blueprintKeys.detail(blueprintRid),
      });
    },
  });
}

export function usePreApplyCheck(blueprintRid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<BlueprintPreApplyCheck>(
        `/blueprints/${blueprintRid}/pre-apply-check`,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: blueprintKeys.detail(blueprintRid),
      });
    },
  });
}

export function useApplyBlueprint(blueprintRid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<BlueprintApplyResult>(
        `/blueprints/${blueprintRid}/apply`,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: blueprintKeys.detail(blueprintRid),
      });
    },
  });
}

export function useRetryItem(blueprintRid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      itemRid,
      userEdits,
    }: {
      itemRid: string;
      userEdits?: Record<string, unknown>;
    }) => {
      const { data } = await apiClient.post<BlueprintItemRetryResult>(
        `/blueprints/${blueprintRid}/items/${itemRid}/retry`,
        { userEdits },
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: blueprintKeys.detail(blueprintRid),
      });
    },
  });
}
