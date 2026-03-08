import { routes } from '../../../shared/config/routes.ts'
import type {
  AdminUsersBlockedFilter,
  AdminUsersQueryState,
  AdminUsersRoleFilter,
  AdminUsersSortDirection,
  AdminUsersSortField,
} from '../../../entities/admin-user/model/types.ts'
import {
  adminUsersBlockedFilterValues,
  adminUsersContract,
  adminUsersRoleFilterValues,
  adminUsersSortDirectionValues,
  adminUsersSortFieldValues,
} from '../../../entities/admin-user/model/types.ts'

export type AdminUsersRouteValidationErrors = Partial<
Record<'blocked' | 'role' | 'query' | 'page' | 'pageSize' | 'sortField' | 'sortDirection', string>
>

export type AdminUsersRouteState = {
  queryState: AdminUsersQueryState
  errors: AdminUsersRouteValidationErrors
}

const positiveIntegerPattern = /^[1-9]\d*$/

export const defaultAdminUsersQueryState: AdminUsersQueryState = {
  blocked: adminUsersContract.defaultBlockedFilter,
  role: adminUsersContract.defaultRoleFilter,
  query: null,
  page: adminUsersContract.defaultPage,
  pageSize: adminUsersContract.defaultPageSize,
  sortField: adminUsersContract.defaultSortField,
  sortDirection: adminUsersContract.defaultSortDirection,
}

function normalizeOptionalNonEmptyString(value: string | null): string | null {
  if (value === null) {
    return null
  }

  const normalizedValue = value.trim()
  return normalizedValue.length > 0 ? normalizedValue : null
}

function isBlockedFilter(value: string): value is AdminUsersBlockedFilter {
  return adminUsersBlockedFilterValues.includes(value as AdminUsersBlockedFilter)
}

function isRoleFilter(value: string): value is AdminUsersRoleFilter {
  return adminUsersRoleFilterValues.includes(value as AdminUsersRoleFilter)
}

function isSortField(value: string): value is AdminUsersSortField {
  return adminUsersSortFieldValues.includes(value as AdminUsersSortField)
}

function isSortDirection(value: string): value is AdminUsersSortDirection {
  return adminUsersSortDirectionValues.includes(value as AdminUsersSortDirection)
}

function parseBlockedFilter(
  searchParams: URLSearchParams,
  errors: AdminUsersRouteValidationErrors,
): AdminUsersBlockedFilter {
  const rawValue = normalizeOptionalNonEmptyString(searchParams.get('blocked'))
  if (rawValue === null) {
    return adminUsersContract.defaultBlockedFilter
  }

  if (isBlockedFilter(rawValue)) {
    return rawValue
  }

  errors.blocked = 'blocked must be one of: all, true, false.'
  return adminUsersContract.defaultBlockedFilter
}

function parseRoleFilter(
  searchParams: URLSearchParams,
  errors: AdminUsersRouteValidationErrors,
): AdminUsersRoleFilter {
  const rawValue = normalizeOptionalNonEmptyString(searchParams.get('role'))
  if (rawValue === null) {
    return adminUsersContract.defaultRoleFilter
  }

  if (isRoleFilter(rawValue)) {
    return rawValue
  }

  errors.role = 'role must be one of: all, admin, user.'
  return adminUsersContract.defaultRoleFilter
}

function parseSearchQuery(
  searchParams: URLSearchParams,
  errors: AdminUsersRouteValidationErrors,
): string | null {
  const rawValue = searchParams.get('query')
  const normalizedQuery = normalizeOptionalNonEmptyString(rawValue)
  if (normalizedQuery === null) {
    return null
  }

  if (normalizedQuery.length > adminUsersContract.maxQueryLength) {
    errors.query = `query must be ${String(adminUsersContract.maxQueryLength)} characters or less.`
    return null
  }

  return normalizedQuery
}

function parsePositiveInteger(
  rawValue: string | null,
  fallbackValue: number,
  minValue: number,
  maxValue: number,
  fieldName: 'page' | 'pageSize',
  errors: AdminUsersRouteValidationErrors,
): number {
  const normalizedValue = normalizeOptionalNonEmptyString(rawValue)
  if (normalizedValue === null) {
    return fallbackValue
  }

  if (!positiveIntegerPattern.test(normalizedValue)) {
    errors[fieldName] = `${fieldName} must be a positive integer.`
    return fallbackValue
  }

  const parsedValue = Number(normalizedValue)
  if (!Number.isSafeInteger(parsedValue) || parsedValue < minValue || parsedValue > maxValue) {
    errors[fieldName] = `${fieldName} must be between ${String(minValue)} and ${String(maxValue)}.`
    return fallbackValue
  }

  return parsedValue
}

function parseSortField(
  searchParams: URLSearchParams,
  errors: AdminUsersRouteValidationErrors,
): AdminUsersSortField {
  const rawValue = normalizeOptionalNonEmptyString(searchParams.get('sortField'))
  if (rawValue === null) {
    return adminUsersContract.defaultSortField
  }

  if (isSortField(rawValue)) {
    return rawValue
  }

  errors.sortField = 'sortField must be one of: updatedAt, createdAt, userName, email.'
  return adminUsersContract.defaultSortField
}

function parseSortDirection(
  searchParams: URLSearchParams,
  errors: AdminUsersRouteValidationErrors,
): AdminUsersSortDirection {
  const rawValue = normalizeOptionalNonEmptyString(searchParams.get('sortDirection'))
  if (rawValue === null) {
    return adminUsersContract.defaultSortDirection
  }

  if (isSortDirection(rawValue)) {
    return rawValue
  }

  errors.sortDirection = 'sortDirection must be one of: asc, desc.'
  return adminUsersContract.defaultSortDirection
}

export function normalizeAdminUsersSearchQueryInput(value: string): string | null {
  const normalizedValue = value.trim()
  if (normalizedValue.length === 0 || normalizedValue.length > adminUsersContract.maxQueryLength) {
    return null
  }

  return normalizedValue
}

export function parseAdminUsersRouteState(search: string): AdminUsersRouteState {
  const searchParams = new URLSearchParams(search)
  const errors: AdminUsersRouteValidationErrors = {}

  const queryState: AdminUsersQueryState = {
    blocked: parseBlockedFilter(searchParams, errors),
    role: parseRoleFilter(searchParams, errors),
    query: parseSearchQuery(searchParams, errors),
    page: parsePositiveInteger(
      searchParams.get('page'),
      adminUsersContract.defaultPage,
      1,
      Number.MAX_SAFE_INTEGER,
      'page',
      errors,
    ),
    pageSize: parsePositiveInteger(
      searchParams.get('pageSize'),
      adminUsersContract.defaultPageSize,
      1,
      adminUsersContract.maxPageSize,
      'pageSize',
      errors,
    ),
    sortField: parseSortField(searchParams, errors),
    sortDirection: parseSortDirection(searchParams, errors),
  }

  return {
    queryState,
    errors,
  }
}

export function buildAdminUsersRoutePath(queryState: AdminUsersQueryState): string {
  const searchParams = new URLSearchParams()

  if (queryState.blocked !== adminUsersContract.defaultBlockedFilter) {
    searchParams.set('blocked', queryState.blocked)
  }

  if (queryState.role !== adminUsersContract.defaultRoleFilter) {
    searchParams.set('role', queryState.role)
  }

  if (queryState.query !== null) {
    searchParams.set('query', queryState.query)
  }

  if (queryState.page !== adminUsersContract.defaultPage) {
    searchParams.set('page', String(queryState.page))
  }

  if (queryState.pageSize !== adminUsersContract.defaultPageSize) {
    searchParams.set('pageSize', String(queryState.pageSize))
  }

  if (queryState.sortField !== adminUsersContract.defaultSortField) {
    searchParams.set('sortField', queryState.sortField)
  }

  if (queryState.sortDirection !== adminUsersContract.defaultSortDirection) {
    searchParams.set('sortDirection', queryState.sortDirection)
  }

  const queryString = searchParams.toString()
  return queryString.length > 0 ? `${routes.adminUsers.path}?${queryString}` : routes.adminUsers.path
}

