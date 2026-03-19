import type { APIRequestContext } from '@playwright/test';
import { API } from './api';

/**
 * Delete all Object Types whose `id` starts with the given prefix.
 *
 * Safe deletion order:
 * 1. Unset isPrimaryKey on any PK properties
 * 2. Deprecate any active properties (active cannot be deleted directly)
 * 3. Delete all properties
 * 4. Delete the Object Type
 */
export async function cleanupByPrefix(
  request: APIRequestContext,
  prefix: string,
): Promise<void> {
  const resp = await request.get(`${API}/object-types`);
  if (!resp.ok()) return;

  const data = await resp.json();
  for (const ot of data.items) {
    if (!(ot.id as string).startsWith(prefix)) continue;

    // Clean up properties first
    const propResp = await request.get(`${API}/object-types/${ot.rid}/properties`);
    if (propResp.ok()) {
      const propData = await propResp.json();
      for (const prop of propData.items) {
        // Unset PK if set
        if (prop.isPrimaryKey) {
          await request.put(`${API}/object-types/${ot.rid}/properties/${prop.rid}`, {
            data: { isPrimaryKey: false },
          });
        }
        // Deprecate if active (active properties cannot be deleted)
        if (prop.status === 'active') {
          await request.put(`${API}/object-types/${ot.rid}/properties/${prop.rid}`, {
            data: { status: 'deprecated' },
          });
        }
        await request.delete(`${API}/object-types/${ot.rid}/properties/${prop.rid}`);
      }
    }

    await request.delete(`${API}/object-types/${ot.rid}`);
  }
}
