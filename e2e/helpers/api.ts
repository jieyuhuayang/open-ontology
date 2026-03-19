import type { APIRequestContext } from '@playwright/test';
import { expect } from '@playwright/test';

/** Base URL for backend API */
export const API = 'http://localhost:8000/api/v1';

/**
 * Create an Object Type via API. Returns the RID.
 */
export async function createObjectType(
  request: APIRequestContext,
  id: string,
  displayName: string,
): Promise<string> {
  const resp = await request.post(`${API}/object-types`, {
    data: {
      id,
      apiName: id.replace(/-/g, '').replace(/^(.)/, (_, c: string) => c.toUpperCase()),
      displayName,
      icon: { name: 'box', color: '#1677ff' },
    },
  });
  expect(resp.ok(), `Failed to create OT '${id}': ${resp.status()}`).toBeTruthy();
  const data = await resp.json();
  return data.rid;
}

/**
 * Create a Property on an Object Type via API.
 */
export async function createProperty(
  request: APIRequestContext,
  otRid: string,
  id: string,
  opts: {
    apiName?: string;
    baseType?: string;
    arrayInnerType?: string;
    status?: string;
  } = {},
): Promise<{ rid: string; [key: string]: unknown }> {
  const apiName = opts.apiName ?? id.replace(/-/g, '');
  const resp = await request.post(`${API}/object-types/${otRid}/properties`, {
    data: {
      id,
      apiName,
      displayName: id.charAt(0).toUpperCase() + id.slice(1),
      baseType: opts.baseType ?? 'string',
      arrayInnerType: opts.arrayInnerType ?? null,
      status: opts.status ?? 'experimental',
    },
  });
  expect(resp.ok(), `Failed to create property '${id}': ${resp.status()}`).toBeTruthy();
  return resp.json();
}
