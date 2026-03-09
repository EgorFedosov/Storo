import type { ApiFailure, ApiQueryParams, ApiResult, ApiSuccess } from '../../../shared/api/httpClient.ts'
import { apiRequest } from '../../../shared/api/httpClient.ts'
import { normalizeProblemDetails } from '../../../shared/api/problemDetails.ts'
import type {
  AdminModerationMutationResult,
  AdminModerationResult,
  AdminModerationStatus,
  AdminUserListItem,
  AdminUsersPage,
  AdminUsersQueryState,
  AdminUsersSortDirection,
  AdminUsersSortField,
} from './types.ts'
import { adminUsersSortDirectionValues, adminUsersSortFieldValues } from './types.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalizedValue = value.trim()
  return normalizedValue.length > 0 ? normalizedValue : null
}

function normalizeInteger(value: unknown, minimumValue = 0): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return null
  }

  if (value < minimumValue) {
    return null
  }

  return value
}

function normalizeUtcDateTime(value: unknown): string | null {
  const normalizedValue = normalizeNonEmptyString(value)
  if (normalizedValue === null) {
    return null
  }

  return Number.isNaN(Date.parse(normalizedValue)) ? null : normalizedValue
}

function normalizeRoles(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  const uniqueRoles = new Set<string>()
  for (const roleValue of value) {
    const role = normalizeNonEmptyString(roleValue)
    if (role === null) {
      return null
    }

    uniqueRoles.add(role)
  }

  return Array.from(uniqueRoles).sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: 'base' }))
}

function isSortField(value: string): value is AdminUsersSortField {
  return adminUsersSortFieldValues.includes(value as AdminUsersSortField)
}

function isSortDirection(value: string): value is AdminUsersSortDirection {
  return adminUsersSortDirectionValues.includes(value as AdminUsersSortDirection)
}

function normalizeAdminUserListItem(payload: unknown): AdminUserListItem | null {
  if (!isRecord(payload)) {
    return null
  }

  const id = normalizeNonEmptyString(payload.id)
  const email = normalizeNonEmptyString(payload.email)
  const userName = normalizeNonEmptyString(payload.userName)
  const displayName = normalizeNonEmptyString(payload.displayName)
  const roles = normalizeRoles(payload.roles)
  const createdAt = normalizeUtcDateTime(payload.createdAt)
  const updatedAt = normalizeUtcDateTime(payload.updatedAt)

  if (
    id === null
    || email === null
    || userName === null
    || displayName === null
    || roles === null
    || createdAt === null
    || updatedAt === null
    || typeof payload.isBlocked !== 'boolean'
  ) {
    return null
  }

  return {
    id,
    email,
    userName,
    displayName,
    isBlocked: payload.isBlocked,
    roles,
    createdAt,
    updatedAt,
  }
}

function normalizeAdminUsersPage(payload: unknown): AdminUsersPage | null {
  if (!isRecord(payload) || !Array.isArray(payload.items) || !isRecord(payload.sort)) {
    return null
  }

  const items: AdminUserListItem[] = []
  for (const rawItem of payload.items) {
    const normalizedItem = normalizeAdminUserListItem(rawItem)
    if (normalizedItem === null) {
      return null
    }

    items.push(normalizedItem)
  }

  const page = normalizeInteger(payload.page, 1)
  const pageSize = normalizeInteger(payload.pageSize, 1)
  const totalCount = normalizeInteger(payload.totalCount, 0)
  const sortField = normalizeNonEmptyString(payload.sort.field)
  const sortDirection = normalizeNonEmptyString(payload.sort.direction)

  if (
    page === null
    || pageSize === null
    || totalCount === null
    || sortField === null
    || sortDirection === null
    || !isSortField(sortField)
    || !isSortDirection(sortDirection)
  ) {
    return null
  }

  return {
    items,
    page,
    pageSize,
    totalCount,
    sort: {
      field: sortField,
      direction: sortDirection,
    },
  }
}

function normalizeModerationStatus(value: unknown): AdminModerationStatus | null {
  if (
    value === 'blocked'
    || value === 'unblocked'
    || value === 'admin_granted'
    || value === 'admin_revoked'
  ) {
    return value
  }

  return null
}

function normalizeAdminModerationResult(payload: unknown): AdminModerationResult | null {
  if (!isRecord(payload)) {
    return null
  }

  const userId = normalizeNonEmptyString(payload.userId)
  const status = normalizeModerationStatus(payload.status)

  if (userId === null || status === null || typeof payload.changed !== 'boolean') {
    return null
  }

  return {
    userId,
    status,
    changed: payload.changed,
  }
}

function createAdminUsersQueryParams(queryState: AdminUsersQueryState): ApiQueryParams {
  const queryParams: ApiQueryParams = {
    blocked: queryState.blocked,
    role: queryState.role,
    page: queryState.page,
    pageSize: queryState.pageSize,
    sortField: queryState.sortField,
    sortDirection: queryState.sortDirection,
  }

  if (queryState.query !== null) {
    queryParams.query = queryState.query
  }

  return queryParams
}

function createInvalidPayloadFailure(result: ApiSuccess<unknown>): ApiFailure {
  const detail = 'Received invalid response payload from /admin/users.'
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

function createInvalidModerationPayloadFailure(
  result: ApiSuccess<unknown>,
  path: string,
): ApiFailure {
  const detail = `Received invalid response payload from ${path}.`
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

export async function fetchAdminUsersPage(
  queryState: AdminUsersQueryState,
  signal?: AbortSignal,
): Promise<ApiResult<AdminUsersPage>> {
  const result = await apiRequest<unknown>('/admin/users', {
    query: createAdminUsersQueryParams(queryState),
    signal,
  })

  if (!result.ok) {
    return result
  }

  const normalizedPayload = normalizeAdminUsersPage(result.data)
  if (normalizedPayload === null) {
    return createInvalidPayloadFailure(result)
  }

  return {
    ...result,
    data: normalizedPayload,
  }
}

async function mutateModerationEndpoint(
  path: string,
  method: 'PUT' | 'DELETE',
  action: AdminModerationMutationResult['action'],
  userId: string,
  signal?: AbortSignal,
): Promise<ApiResult<AdminModerationMutationResult>> {
  const result = await apiRequest<unknown>(path, {
    method,
    signal,
  })

  if (!result.ok) {
    return result
  }

  if (result.status === 204) {
    return {
      ...result,
      data: {
        userId,
        action,
        status: null,
        changed: true,
      },
    }
  }

  const normalizedPayload = normalizeAdminModerationResult(result.data)
  if (normalizedPayload === null) {
    return createInvalidModerationPayloadFailure(result, path)
  }

  return {
    ...result,
    data: {
      userId: normalizedPayload.userId,
      action,
      status: normalizedPayload.status,
      changed: normalizedPayload.changed,
    },
  }
}

export async function blockAdminUser(
  userId: string,
  signal?: AbortSignal,
): Promise<ApiResult<AdminModerationMutationResult>> {
  return mutateModerationEndpoint(`/admin/users/${userId}/block`, 'PUT', 'block', userId, signal)
}

export async function unblockAdminUser(
  userId: string,
  signal?: AbortSignal,
): Promise<ApiResult<AdminModerationMutationResult>> {
  return mutateModerationEndpoint(`/admin/users/${userId}/block`, 'DELETE', 'unblock', userId, signal)
}

export async function grantAdminRole(
  userId: string,
  signal?: AbortSignal,
): Promise<ApiResult<AdminModerationMutationResult>> {
  return mutateModerationEndpoint(`/admin/users/${userId}/roles/admin`, 'PUT', 'grant_admin', userId, signal)
}

export async function revokeAdminRole(
  userId: string,
  signal?: AbortSignal,
): Promise<ApiResult<AdminModerationMutationResult>> {
  return mutateModerationEndpoint(`/admin/users/${userId}/roles/admin`, 'DELETE', 'revoke_admin', userId, signal)
}

export async function deleteAdminUser(
  userId: string,
  signal?: AbortSignal,
): Promise<ApiResult<AdminModerationMutationResult>> {
  return mutateModerationEndpoint(`/admin/users/${userId}`, 'DELETE', 'delete', userId, signal)
}
