import type { APIRequestContext } from '@playwright/test';
import { API } from './api';

/**
 * Delete all Object Types whose `id` starts with the given prefix,
 * along with any Link Types that reference them.
 *
 * Safe deletion order:
 * 1. Delete Link Types that reference any matching OTs (prevents FK constraint errors)
 * 2. Unset isPrimaryKey on any PK properties
 * 3. Deprecate any active properties (active cannot be deleted directly)
 * 4. Delete all properties
 * 5. Delete the Object Type
 */
export async function cleanupByPrefix(
  request: APIRequestContext,
  prefix: string,
): Promise<void> {
  if (prefix.length < 5) {
    throw new Error(
      `Cleanup prefix too short: "${prefix}" (min 5 chars). This prevents accidental deletion of non-test data.`,
    );
  }

  // Discard any pending working-state changes first (prevents "in draft" conflicts)
  await request.delete(`${API}/ontologies/ri.ontology.ontology.default/working-state`);

  const resp = await request.get(`${API}/object-types`);
  if (!resp.ok()) return;

  const data = await resp.json();
  const matchingOtRids = new Set<string>();

  for (const ot of data.items) {
    if ((ot.id as string).startsWith(prefix)) {
      matchingOtRids.add(ot.rid as string);
    }
  }

  if (matchingOtRids.size === 0) return;

  // Phase 1: Delete Link Types that reference matching OTs
  const ltResp = await request.get(`${API}/link-types`);
  if (ltResp.ok()) {
    const ltData = await ltResp.json();
    for (const lt of ltData.items) {
      // Check if either endpoint references a matching OT
      const endpoints = lt.endpoints ?? [];
      const refersToMatchingOt = endpoints.some(
        (ep: { objectTypeRid: string }) => matchingOtRids.has(ep.objectTypeRid),
      );
      // Also check by link type id prefix
      const ltIdMatches = (lt.id as string).startsWith(prefix);

      if (refersToMatchingOt || ltIdMatches) {
        await request.delete(`${API}/link-types/${lt.rid}`);
      }
    }
  }

  // Phase 2: Delete matching Object Types (with property cleanup)
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

  // Discard any changes created by cleanup
  await request.delete(`${API}/ontologies/ri.ontology.ontology.default/working-state`);
}
