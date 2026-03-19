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
      const { data } = await apiClient.get<WorkingState>(
        `/ontologies/${ontologyRid}/working-state`,
      );
      return data;
    },
    retry: false,
  });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workingStateKeys.all });
      queryClient.invalidateQueries({ queryKey: objectTypeKeys.all });
      queryClient.invalidateQueries({ queryKey: linkTypeKeys.all });
      queryClient.invalidateQueries({ queryKey: propertyKeys.all });
      queryClient.invalidateQueries({ queryKey: historyKeys.all });
    },
  });
}

export function useDiscardAll(ontologyRid: string = DEFAULT_ONTOLOGY_RID) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/ontologies/${ontologyRid}/working-state`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workingStateKeys.all });
      queryClient.invalidateQueries({ queryKey: objectTypeKeys.all });
      queryClient.invalidateQueries({ queryKey: linkTypeKeys.all });
      queryClient.invalidateQueries({ queryKey: propertyKeys.all });
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workingStateKeys.all });
    },
  });
}
