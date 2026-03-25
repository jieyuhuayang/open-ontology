import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { objectTypeKeys } from '@/api/object-types';
import { propertyKeys } from '@/api/properties';
import { linkTypeKeys } from '@/api/link-types';
import type { components } from '@/generated/api';

// --- Types (from openapi-typescript) ---

export type SidekickContext = components['schemas']['SidekickContext'];
export type Suggestion = components['schemas']['Suggestion'];
export type SuggestionsResponse = components['schemas']['SuggestionsResponse'];
export type SuggestionApplyRequest = components['schemas']['SuggestionApplyRequest'];
export type SuggestionApplyResponse = components['schemas']['SuggestionApplyResponse'];
export type GenerateContentRequest = components['schemas']['GenerateContentRequest'];
export type GenerateContentResponse = components['schemas']['GenerateContentResponse'];

// --- Query keys ---

export const sidekickKeys = {
  all: ['sidekick'] as const,
  suggestions: (ctx: SidekickContext) =>
    [...sidekickKeys.all, 'suggestions', ctx] as const,
};

// --- Hooks ---

export function useSidekickSuggestions(context: SidekickContext | null) {
  return useQuery({
    queryKey: context ? sidekickKeys.suggestions(context) : sidekickKeys.all,
    queryFn: async () => {
      if (!context) return { suggestions: [], hasLlmSuggestions: false };
      const { data } = await apiClient.post<SuggestionsResponse>(
        '/sidekick/suggestions',
        context,
      );
      return data;
    },
    enabled: !!context,
  });
}

export function useApplySuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: SuggestionApplyRequest) => {
      const { data } = await apiClient.post<SuggestionApplyResponse>(
        '/sidekick/apply',
        req,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: objectTypeKeys.all });
      void queryClient.invalidateQueries({ queryKey: propertyKeys.all });
      void queryClient.invalidateQueries({ queryKey: linkTypeKeys.all });
      void queryClient.invalidateQueries({ queryKey: sidekickKeys.all });
    },
  });
}

export function useGenerateContent() {
  return useMutation({
    mutationFn: async (req: GenerateContentRequest) => {
      const { data } = await apiClient.post<GenerateContentResponse>(
        '/sidekick/generate-content',
        req,
      );
      return data;
    },
  });
}
