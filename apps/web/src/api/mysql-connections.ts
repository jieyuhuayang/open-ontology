import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import type {
  MySQLConnection,
  MySQLConnectionCreateRequest,
  MySQLConnectionTestRequest,
  MySQLTableInfo,
  MySQLColumnInfo,
  MySQLTablePreview,
  ConnectionTestResponse,
} from '@/api/types';

export const mysqlConnectionKeys = {
  all: ['mysql-connections'] as const,
  lists: () => [...mysqlConnectionKeys.all, 'list'] as const,
  list: () => [...mysqlConnectionKeys.lists()] as const,
  details: () => [...mysqlConnectionKeys.all, 'detail'] as const,
  detail: (rid: string) => [...mysqlConnectionKeys.details(), rid] as const,
  tables: (rid: string) => [...mysqlConnectionKeys.detail(rid), 'tables'] as const,
  tableColumns: (rid: string, table: string) =>
    [...mysqlConnectionKeys.tables(rid), table, 'columns'] as const,
  tablePreview: (rid: string, table: string) =>
    [...mysqlConnectionKeys.tables(rid), table, 'preview'] as const,
  importedTables: (rid: string) => [...mysqlConnectionKeys.detail(rid), 'imported-tables'] as const,
};

export function useMySQLConnections() {
  return useQuery({
    queryKey: mysqlConnectionKeys.list(),
    queryFn: async () => {
      const { data } = await apiClient.get<MySQLConnection[]>('/mysql-connections');
      return data;
    },
  });
}

export function useMySQLConnection(rid: string | null) {
  return useQuery({
    queryKey: mysqlConnectionKeys.detail(rid ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<MySQLConnection>(`/mysql-connections/${rid}`);
      return data;
    },
    enabled: !!rid,
  });
}

export function useCreateMySQLConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: MySQLConnectionCreateRequest) => {
      const { data } = await apiClient.post<MySQLConnection>('/mysql-connections', req);
      return data;
    },
    meta: { skipGlobalError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mysqlConnectionKeys.lists() });
    },
  });
}

export function useTestMySQLConnection() {
  return useMutation({
    mutationFn: async (req: MySQLConnectionTestRequest) => {
      const { data } = await apiClient.post<ConnectionTestResponse>('/mysql-connections/test', req);
      return data;
    },
    meta: { skipGlobalError: true },
  });
}

export function useDeleteMySQLConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rid: string) => {
      await apiClient.delete(`/mysql-connections/${rid}`);
    },
    meta: { skipGlobalError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mysqlConnectionKeys.lists() });
    },
  });
}

export function useMySQLTables(rid: string) {
  return useQuery({
    queryKey: mysqlConnectionKeys.tables(rid),
    queryFn: async () => {
      const { data } = await apiClient.get<MySQLTableInfo[]>(`/mysql-connections/${rid}/tables`);
      return data;
    },
    enabled: !!rid,
  });
}

export function useMySQLTableColumns(rid: string, table: string) {
  return useQuery({
    queryKey: mysqlConnectionKeys.tableColumns(rid, table),
    queryFn: async () => {
      const { data } = await apiClient.get<MySQLColumnInfo[]>(
        `/mysql-connections/${rid}/tables/${table}/columns`,
      );
      return data;
    },
    enabled: !!rid && !!table,
  });
}

export function useMySQLImportedTables(rid: string) {
  return useQuery({
    queryKey: mysqlConnectionKeys.importedTables(rid),
    queryFn: async () => {
      const { data } = await apiClient.get<string[]>(`/mysql-connections/${rid}/imported-tables`);
      return data;
    },
    enabled: !!rid,
  });
}

export function useMySQLTablePreview(rid: string, table: string) {
  return useQuery({
    queryKey: mysqlConnectionKeys.tablePreview(rid, table),
    queryFn: async () => {
      const { data } = await apiClient.get<MySQLTablePreview>(
        `/mysql-connections/${rid}/tables/${table}/preview`,
      );
      return data;
    },
    enabled: !!rid && !!table,
  });
}
