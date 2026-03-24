import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import type {
  AgentSession,
  AgentSessionCreate,
  AgentSessionList,
  AgentSessionDetail,
} from '@/api/types';

export const agentSessionKeys = {
  all: ['agent-sessions'] as const,
  lists: () => [...agentSessionKeys.all, 'list'] as const,
  list: (params: { ontologyRid?: string; page?: number; pageSize?: number }) =>
    [...agentSessionKeys.lists(), params] as const,
  details: () => [...agentSessionKeys.all, 'detail'] as const,
  detail: (rid: string) => [...agentSessionKeys.details(), rid] as const,
};

export function useAgentSessions(
  ontologyRid?: string,
  page = 1,
  pageSize = 20,
) {
  return useQuery({
    queryKey: agentSessionKeys.list({ ontologyRid, page, pageSize }),
    queryFn: async () => {
      const { data } = await apiClient.get<AgentSessionList>(
        '/agent/sessions',
        {
          params: { ontologyRid, page, pageSize },
        },
      );
      return data;
    },
  });
}

export function useAgentSessionDetail(rid: string) {
  return useQuery({
    queryKey: agentSessionKeys.detail(rid),
    queryFn: async () => {
      const { data } = await apiClient.get<AgentSessionDetail>(
        `/agent/sessions/${rid}`,
      );
      return data;
    },
    enabled: !!rid,
  });
}

export function useCreateAgentSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: AgentSessionCreate) => {
      const { data } = await apiClient.post<AgentSession>(
        '/agent/sessions',
        req,
      );
      return data;
    },
    meta: { skipGlobalError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentSessionKeys.lists() });
    },
  });
}

export function useDeleteAgentSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rid: string) => {
      await apiClient.delete(`/agent/sessions/${rid}`);
    },
    onSuccess: (_data, rid) => {
      queryClient.invalidateQueries({ queryKey: agentSessionKeys.lists() });
      queryClient.removeQueries({ queryKey: agentSessionKeys.detail(rid) });
    },
  });
}
