import { useQuery, useMutation } from '@tanstack/react-query';
import apiClient from '@/api/client';
import type { ImportTask, MySQLImportRequest, FileConfirmRequest } from '@/api/types';

export interface UploadPreviewColumn {
  name: string;
  inferredType: string;
  sampleValues: string[];
}

export interface UploadPreviewData {
  columns: UploadPreviewColumn[];
  rows: Record<string, string>[];
  totalRows: number;
  hasHeader: boolean;
}

export interface UploadPreviewResponse {
  fileToken: string;
  filename: string;
  fileSize: number;
  sheets: string[] | null;
  defaultSheet: string | null;
  preview: UploadPreviewData;
}

export const importTaskKeys = {
  all: ['import-tasks'] as const,
  detail: (taskId: string) => [...importTaskKeys.all, taskId] as const,
};

export function useMySQLImport() {
  return useMutation({
    mutationFn: async (req: MySQLImportRequest) => {
      const { data } = await apiClient.post<ImportTask>('/datasets/import/mysql', req);
      return data;
    },
    meta: { skipGlobalError: true },
  });
}

export function useFileUploadPreview() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await apiClient.post<UploadPreviewResponse>(
        '/datasets/upload/preview',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        },
      );
      return data;
    },
    meta: { skipGlobalError: true },
  });
}

export function useFileImportConfirm() {
  return useMutation({
    mutationFn: async (req: FileConfirmRequest) => {
      const { data } = await apiClient.post<ImportTask>('/datasets/upload/confirm', req);
      return data;
    },
    meta: { skipGlobalError: true },
  });
}

export function useImportTask(taskId?: string) {
  return useQuery({
    queryKey: importTaskKeys.detail(taskId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<ImportTask>(`/import-tasks/${taskId}`);
      return data;
    },
    enabled: !!taskId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 1500;
      if (data.status === 'pending' || data.status === 'running') return 1500;
      return false;
    },
  });
}
