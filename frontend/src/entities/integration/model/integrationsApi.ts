import type {
  ApiFailure,
  ApiRequestOptions,
  ApiResult,
  ApiSuccess,
} from '../../../shared/api/httpClient.ts'
import { apiRequest } from '../../../shared/api/httpClient.ts'
import { normalizeProblemDetails } from '../../../shared/api/problemDetails.ts'
import { integrationContract } from './contracts.ts'
import type {
  CreateSupportTicketRequest,
  CreateSupportTicketResponse,
  GetSalesforceMeResponse,
  GetSupportTicketStatusResponse,
  InventoryOdooTokenResponse,
  SyncSalesforceContactRequest,
  SyncSalesforceContactResponse,
} from './types.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function normalizeNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }

  return normalizeString(value)
}

function normalizeIsoDateTime(value: unknown): string | null {
  const normalizedValue = normalizeString(value)
  if (normalizedValue === null) {
    return null
  }

  return Number.isNaN(Date.parse(normalizedValue)) ? null : normalizedValue
}

function normalizeNullableIsoDateTime(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }

  return normalizeIsoDateTime(value)
}

function createInvalidPayloadFailure(result: ApiSuccess<unknown>, path: string): ApiFailure {
  const detail = `Received invalid response format from ${path}.`
  const problem = normalizeProblemDetails({
    payload: null,
    status: result.status,
    fallbackTitle: 'Invalid JSON Response',
    fallbackDetail: detail,
  })

  return {
    ok: false,
    status: result.status,
    problem,
    error: {
      kind: 'invalid_json',
      message: detail,
      problem,
    },
    meta: result.meta,
  }
}

async function requestAndNormalize<TData>(
  path: string,
  options: ApiRequestOptions,
  normalizePayload: (payload: unknown) => TData | null,
): Promise<ApiResult<TData>> {
  const result = await apiRequest<unknown>(path, options)
  if (!result.ok) {
    return result
  }

  const normalizedPayload = normalizePayload(result.data)
  if (normalizedPayload === null) {
    return createInvalidPayloadFailure(result, path)
  }

  return {
    ...result,
    data: normalizedPayload,
  }
}

function normalizeCreateSupportTicketResponse(payload: unknown): CreateSupportTicketResponse | null {
  if (!isRecord(payload)) {
    return null
  }

  const createdAtUtc = normalizeIsoDateTime(payload.createdAtUtc)
  if (createdAtUtc === null) {
    return null
  }

  return {
    ticketId: normalizeNullableString(payload.ticketId),
    provider: normalizeNullableString(payload.provider),
    status: normalizeNullableString(payload.status),
    uploadedFileRef: normalizeNullableString(payload.uploadedFileRef),
    createdAtUtc,
  }
}

function normalizeSupportTicketStatusResponse(payload: unknown): GetSupportTicketStatusResponse | null {
  if (!isRecord(payload)) {
    return null
  }

  const createdAtUtc = normalizeIsoDateTime(payload.createdAtUtc)
  const uploadedAtUtc = normalizeNullableIsoDateTime(payload.uploadedAtUtc)

  if (createdAtUtc === null) {
    return null
  }

  return {
    ticketId: normalizeNullableString(payload.ticketId),
    provider: normalizeNullableString(payload.provider),
    status: normalizeNullableString(payload.status),
    uploadedFileRef: normalizeNullableString(payload.uploadedFileRef),
    errorMessage: normalizeNullableString(payload.errorMessage),
    createdAtUtc,
    uploadedAtUtc,
  }
}

function normalizeSalesforceMeResponse(payload: unknown): GetSalesforceMeResponse | null {
  if (!isRecord(payload) || typeof payload.isLinked !== 'boolean') {
    return null
  }

  return {
    isLinked: payload.isLinked,
    sfAccountId: normalizeNullableString(payload.sfAccountId),
    sfContactId: normalizeNullableString(payload.sfContactId),
    lastSyncStatus: normalizeNullableString(payload.lastSyncStatus),
    lastSyncedAt: normalizeNullableIsoDateTime(payload.lastSyncedAt),
  }
}

function normalizeSalesforceSyncResponse(payload: unknown): SyncSalesforceContactResponse | null {
  if (!isRecord(payload)) {
    return null
  }

  const syncedAt = normalizeIsoDateTime(payload.syncedAt)
  if (syncedAt === null) {
    return null
  }

  return {
    syncStatus: normalizeNullableString(payload.syncStatus),
    sfAccountId: normalizeNullableString(payload.sfAccountId),
    sfContactId: normalizeNullableString(payload.sfContactId),
    syncedAt,
    errorMessage: normalizeNullableString(payload.errorMessage),
  }
}

function normalizeOdooTokenResponse(payload: unknown): InventoryOdooTokenResponse | null {
  if (!isRecord(payload)) {
    return null
  }

  const createdAt = normalizeIsoDateTime(payload.createdAt)
  if (createdAt === null) {
    return null
  }

  return {
    inventoryId: normalizeNullableString(payload.inventoryId),
    plainToken: normalizeNullableString(payload.plainToken),
    maskedToken: normalizeNullableString(payload.maskedToken),
    createdAt,
  }
}

export function createFixedDropboxSupportTicketRequest(
  payload: Omit<CreateSupportTicketRequest, 'provider'>,
): CreateSupportTicketRequest {
  return {
    ...payload,
    provider: integrationContract.supportTicket.fixedProvider,
  }
}

export async function createSupportTicket(
  payload: CreateSupportTicketRequest,
  signal?: AbortSignal,
): Promise<ApiResult<CreateSupportTicketResponse>> {
  return requestAndNormalize<CreateSupportTicketResponse>(
    '/integrations/support-tickets',
    {
      method: 'POST',
      body: payload,
      signal,
    },
    normalizeCreateSupportTicketResponse,
  )
}

export async function getSupportTicketStatus(
  ticketId: string,
  signal?: AbortSignal,
): Promise<ApiResult<GetSupportTicketStatusResponse>> {
  return requestAndNormalize<GetSupportTicketStatusResponse>(
    `/integrations/support-tickets/${ticketId}`,
    {
      signal,
    },
    normalizeSupportTicketStatusResponse,
  )
}

export async function getSalesforceMe(
  signal?: AbortSignal,
): Promise<ApiResult<GetSalesforceMeResponse>> {
  return requestAndNormalize<GetSalesforceMeResponse>(
    '/integrations/salesforce/me',
    {
      signal,
    },
    normalizeSalesforceMeResponse,
  )
}

export async function syncSalesforceContact(
  payload: SyncSalesforceContactRequest,
  signal?: AbortSignal,
): Promise<ApiResult<SyncSalesforceContactResponse>> {
  return requestAndNormalize<SyncSalesforceContactResponse>(
    '/integrations/salesforce/sync',
    {
      method: 'POST',
      body: payload,
      signal,
    },
    normalizeSalesforceSyncResponse,
  )
}

export async function generateInventoryOdooApiToken(
  inventoryId: string,
  signal?: AbortSignal,
): Promise<ApiResult<InventoryOdooTokenResponse>> {
  return requestAndNormalize<InventoryOdooTokenResponse>(
    `/integrations/odoo/inventories/${inventoryId}/token`,
    {
      method: 'POST',
      signal,
    },
    normalizeOdooTokenResponse,
  )
}

