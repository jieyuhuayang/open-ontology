import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import type { WorkingState, ChangeRecord } from '@/api/types';
import { objectTypeKeys } from '@/api/object-types';
import { linkTypeKeys } from '@/api/link-types';
import { propertyKeys } from '@/api/properties';
import { historyKeys } from '@/api/history';

/** MVP uses a single default ontology. */
export const DEFAULT_ONTOLOGY_RID = 'ri.ontology.ontology.default';

export const workingStateKeys = {
  all: ['working-state'] as const,
  detail: (ontologyRid: string) => [...workingStateKeys.all, ontologyRid] as const,
};

export function useWorkingState(ontologyRid: string = DEFAULT_ONTOLOGY_RID) {
  return useQuery({
    queryKey: workingStateKeys.detail(ontologyRid),
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<WorkingState>(
          `/ontologies/${ontologyRid}/working-state`,
        );
        return data;
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
          return null;
        }
        throw err;
      }
    },
    retry: false,
    staleTime: 5000,
  });
}

/** Invalidate all ontology-related queries after a mutation. */
function invalidateOntologyData(
  queryClient: ReturnType<typeof useQueryClient>,
  opts?: { includeHistory?: boolean },
) {
  queryClient.invalidateQueries({ queryKey: workingStateKeys.all });
  queryClient.invalidateQueries({ queryKey: objectTypeKeys.all });
  queryClient.invalidateQueries({ queryKey: linkTypeKeys.all });
  queryClient.invalidateQueries({ queryKey: propertyKeys.all });
  if (opts?.includeHistory) {
    queryClient.invalidateQueries({ queryKey: historyKeys.all });
  }
}

export function usePublish(ontologyRid: string = DEFAULT_ONTOLOGY_RID) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<ChangeRecord>(
        `/ontologies/${ontologyRid}/save`,
      );
      return data;
    },
    onSuccess: () => invalidateOntologyData(queryClient, { includeHistory: true }),
  });
}

export function useDiscardAll(ontologyRid: string = DEFAULT_ONTOLOGY_RID) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/ontologies/${ontologyRid}/working-state`);
    },
    onSuccess: () => invalidateOntologyData(queryClient),
  });
}

export function useDiscardChange(ontologyRid: string = DEFAULT_ONTOLOGY_RID) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (changeId: string) => {
      await apiClient.delete(
        `/ontologies/${ontologyRid}/working-state/changes/${changeId}`,
      );
    },
    onSuccess: () => invalidateOntologyData(queryClient),
  });
}
