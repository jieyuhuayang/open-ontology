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

/** Default ontology RID (matches backend DEFAULT_ONTOLOGY_RID). */
export const ONTOLOGY_RID = 'ri.ontology.ontology.default';

/**
 * Create a complete OT with dataset + PK + TK, ready to publish.
 * Uses the two-step file upload flow: preview → confirm → create OT.
 * Returns the OT RID.
 */
export async function createPublishableObjectType(
  request: APIRequestContext,
  id: string,
  displayName: string,
): Promise<string> {
  // Step 1: Upload preview
  const previewResp = await request.post(`${API}/datasets/upload/preview`, {
    multipart: {
      file: {
        name: `${id}.csv`,
        mimeType: 'text/csv',
        buffer: Buffer.from('id,name\n1,Alice\n2,Bob\n'),
      },
    },
  });
  expect(previewResp.ok(), `Upload preview failed: ${previewResp.status()}`).toBeTruthy();
  const previewData = await previewResp.json();

  // Step 2: Confirm import
  const confirmResp = await request.post(`${API}/datasets/upload/confirm`, {
    data: {
      fileToken: previewData.fileToken,
      datasetName: `${id}-ds`,
      sheetName: previewData.sheetName ?? null,
      hasHeader: true,
      selectedColumns: previewData.preview.columns.map((c: { name: string }) => c.name),
      columnTypeOverrides: {},
      ontologyRid: ONTOLOGY_RID,
    },
  });
  expect(confirmResp.ok(), `Upload confirm failed: ${confirmResp.status()}`).toBeTruthy();
  const confirmData = await confirmResp.json();
  const taskId = confirmData.taskId;

  // Poll import task until completed
  let dsRid: string | null = null;
  for (let i = 0; i < 30; i++) {
    const taskResp = await request.get(`${API}/import-tasks/${taskId}`);
    if (taskResp.ok()) {
      const taskData = await taskResp.json();
      if (taskData.status === 'completed') {
        dsRid = taskData.datasetRid;
        break;
      }
      if (taskData.status === 'failed') {
        throw new Error(`Import failed: ${taskData.errorMessage}`);
      }
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  expect(dsRid, 'Import task did not complete in time').toBeTruthy();

  // Create OT with backing datasource
  const otResp = await request.post(`${API}/object-types`, {
    data: {
      id,
      apiName: id.replace(/-/g, '').replace(/^(.)/, (_, c: string) => c.toUpperCase()),
      displayName,
      icon: { name: 'box', color: '#1677ff' },
      backingDatasourceRid: dsRid,
    },
  });
  expect(otResp.ok(), `Failed to create OT '${id}': ${otResp.status()}`).toBeTruthy();
  const otRid = (await otResp.json()).rid;

  // Create PK property (mapped to 'id' column)
  await request.post(`${API}/object-types/${otRid}/properties`, {
    data: { id: `${id}-pk`, apiName: `${id.replace(/-/g, '')}Pk`, displayName: 'PK', baseType: 'integer', backingColumn: 'id' },
  });

  // Create TK property (mapped to 'name' column)
  await request.post(`${API}/object-types/${otRid}/properties`, {
    data: { id: `${id}-name`, apiName: `${id.replace(/-/g, '')}Name`, displayName: 'Name', baseType: 'string', backingColumn: 'name' },
  });

  // Set PK and TK
  await request.put(`${API}/object-types/${otRid}`, {
    data: { primaryKeyPropertyId: `${id}-pk`, titleKeyPropertyId: `${id}-name` },
  });

  return otRid;
}

/**
 * Publish (save) all pending changes for the default ontology.
 */
export async function publishChanges(request: APIRequestContext): Promise<void> {
  const resp = await request.post(`${API}/ontologies/${ONTOLOGY_RID}/save`);
  expect(resp.ok(), `Publish failed: ${resp.status()}`).toBeTruthy();
}

/**
 * Discard all pending changes for the default ontology.
 */
export async function discardAll(request: APIRequestContext): Promise<void> {
  await request.delete(`${API}/ontologies/${ONTOLOGY_RID}/working-state`);
}

// --- Blueprint helpers (F017) ---

/**
 * Create an agent session via API. Returns session RID.
 */
export async function createAgentSession(
  request: APIRequestContext,
  opts: { domain?: string; goal?: string } = {},
): Promise<string> {
  const resp = await request.post(`${API}/agent/sessions`, {
    data: {
      ontologyRid: ONTOLOGY_RID,
      domain: opts.domain ?? 'e2e-test',
      goal: opts.goal ?? 'E2E test session',
    },
  });
  expect(resp.ok(), `Failed to create session: ${resp.status()}`).toBeTruthy();
  const data = await resp.json();
  return data.rid;
}

/**
 * Create a blueprint via API. Returns blueprint RID.
 */
export async function createBlueprint(
  request: APIRequestContext,
  sessionRid: string,
  name: string,
): Promise<string> {
  const resp = await request.post(`${API}/blueprints`, {
    data: {
      sessionRid,
      ontologyRid: ONTOLOGY_RID,
      name,
    },
  });
  expect(resp.ok(), `Failed to create blueprint: ${resp.status()}`).toBeTruthy();
  const data = await resp.json();
  return data.rid;
}

/**
 * Create blueprint items in batch. Returns item RIDs.
 */
export async function createBlueprintItems(
  request: APIRequestContext,
  blueprintRid: string,
  items: Array<{
    itemType: string;
    suggestion: Record<string, unknown>;
    confidence: number;
    source?: string;
    sortOrder?: number;
  }>,
): Promise<string[]> {
  const body = items.map((item, idx) => ({
    itemType: item.itemType,
    suggestion: item.suggestion,
    confidence: item.confidence,
    source: item.source ?? 'field_analysis',
    sortOrder: item.sortOrder ?? idx,
  }));
  const resp = await request.post(`${API}/blueprints/${blueprintRid}/items`, {
    data: body,
  });
  expect(resp.ok(), `Failed to create blueprint items: ${resp.status()}`).toBeTruthy();
  const data = await resp.json();
  return (data as Array<{ rid: string }>).map((d) => d.rid);
}

/**
 * Update blueprint status.
 */
export async function updateBlueprintStatus(
  request: APIRequestContext,
  blueprintRid: string,
  status: string,
): Promise<void> {
  const resp = await request.patch(`${API}/blueprints/${blueprintRid}`, {
    data: { status },
  });
  expect(resp.ok(), `Failed to update blueprint status: ${resp.status()}`).toBeTruthy();
}

/**
 * Delete a blueprint (cleanup).
 */
export async function deleteBlueprint(
  request: APIRequestContext,
  blueprintRid: string,
): Promise<void> {
  // First discard if in pending_review
  await request.patch(`${API}/blueprints/${blueprintRid}`, {
    data: { status: 'discarded' },
  });
}

/**
 * Delete an agent session (cleanup).
 */
export async function deleteAgentSession(
  request: APIRequestContext,
  sessionRid: string,
): Promise<void> {
  await request.delete(`${API}/agent/sessions/${sessionRid}`);
}
