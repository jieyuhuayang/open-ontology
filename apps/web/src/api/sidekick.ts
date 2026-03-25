import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { objectTypeKeys } from '@/api/object-types';
import { propertyKeys } from '@/api/properties';
import { linkTypeKeys } from '@/api/link-types';

// --- Types (hand-written until openapi-typescript regeneration) ---

export interface SidekickContext {
  pageType: string;
  entityRid: string;
  ontologyRid: string;
}

export interface Suggestion {
  id: string;
  suggestionType: string;
  title: string;
  description: string;
  confidence: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  source: string;
  reasoning: string;
  requiresLlm: boolean;
  actionPayload: Record<string, unknown> | null;
}

export interface SuggestionsResponse {
  suggestions: Suggestion[];
  hasLlmSuggestions: boolean;
}

export interface SuggestionApplyRequest {
  suggestionType: string;
  entityRid: string;
  actionPayload?: Record<string, unknown> | null;
}

export interface SuggestionApplyResponse {
  success: boolean;
  message: string;
}

export interface GenerateContentResponse {
  content: string;
}

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
    mutationFn: async (req: {
      contentType: string;
      entityRid: string;
      context?: Record<string, unknown>;
    }) => {
      const { data } = await apiClient.post<GenerateContentResponse>(
        '/sidekick/generate-content',
        req,
      );
      return data;
    },
  });
}
