import { normalizePathname, routes } from '../../../shared/config/routes.ts'

export type SearchScope = 'inventories' | 'items'

export type SearchRouteValidationErrors = Partial<
Record<'q' | 'tag' | 'page' | 'pageSize' | 'sort', string>
>

export type SearchRouteState = {
  scope: SearchScope
  q: string | null
  tag: string | null
  page: number
  pageSize: number
  sort: string | null
  errors: SearchRouteValidationErrors
}

export type SearchRouteInput = {
  scope: SearchScope
  q?: string | null
  tag?: string | null
  page?: number | null
  pageSize?: number | null
  sort?: string | null
}

export type SearchNavigationIntent = {
  scope: SearchScope
  q: string
}

export const searchRouteContract = {
  defaultPage: 1,
  defaultPageSize: 20,
  maxPageSize: 100,
  maxQueryLength: 500,
  maxTagLength: 100,
} as const

const positiveIntegerPattern = /^[1-9]\d*$/

function normalizeOptionalText(rawValue: string | null, maxLength: number): string | null {
  if (rawValue === null) {
    return null
  }

  const normalizedValue = rawValue.trim()
  if (normalizedValue.length === 0 || normalizedValue.length > maxLength) {
    return null
  }

  return normalizedValue
}

function parseOptionalPositiveInteger(
  rawValue: string | null,
  fallbackValue: number,
  minValue: number,
  maxValue: number,
  fieldName: 'page' | 'pageSize',
  errors: SearchRouteValidationErrors,
): number {
  if (rawValue === null || rawValue.trim().length === 0) {
    return fallbackValue
  }

  const normalizedValue = rawValue.trim()
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

function isSearchPath(pathname: string): boolean {
  return pathname === '/search'
    || pathname.startsWith('/search/inventories')
    || pathname.startsWith('/search/items')
}

export function resolveSearchScope(pathname: string): SearchScope {
  const normalizedPathname = normalizePathname(pathname)

  if (normalizedPathname.startsWith(routes.searchItems.path)) {
    return 'items'
  }

  return 'inventories'
}

export function normalizeSearchQueryInput(rawValue: string): string | null {
  return normalizeOptionalText(rawValue, searchRouteContract.maxQueryLength)
}

export function parseSearchRouteState(pathname: string, search: string): SearchRouteState {
  const normalizedPathname = normalizePathname(pathname)
  const scope = resolveSearchScope(normalizedPathname)
  const searchParams = new URLSearchParams(search)
  const errors: SearchRouteValidationErrors = {}

  const rawQuery = searchParams.get('q')
  const q = normalizeOptionalText(rawQuery, searchRouteContract.maxQueryLength)
  if (rawQuery !== null && rawQuery.trim().length > searchRouteContract.maxQueryLength) {
    errors.q = `q must be ${String(searchRouteContract.maxQueryLength)} characters or less.`
  }

  const rawTag = searchParams.get('tag')
  const tag = normalizeOptionalText(rawTag, searchRouteContract.maxTagLength)
  if (rawTag !== null && rawTag.trim().length > searchRouteContract.maxTagLength) {
    errors.tag = `tag must be ${String(searchRouteContract.maxTagLength)} characters or less.`
  }

  const page = parseOptionalPositiveInteger(
    searchParams.get('page'),
    searchRouteContract.defaultPage,
    1,
    Number.MAX_SAFE_INTEGER,
    'page',
    errors,
  )

  const pageSize = parseOptionalPositiveInteger(
    searchParams.get('pageSize'),
    searchRouteContract.defaultPageSize,
    1,
    searchRouteContract.maxPageSize,
    'pageSize',
    errors,
  )

  const rawSort = searchParams.get('sort')
  const sort = rawSort === null
    ? null
    : rawSort.trim().length > 0
      ? rawSort.trim()
      : null

  // Missing q/tag on initial open is treated as idle state, not a validation error.
  if (scope === 'items' && q === null && rawQuery !== null && isSearchPath(normalizedPathname)) {
    errors.q = 'q is required for item search.'
  }

  if (
    scope === 'inventories'
    && q === null
    && tag === null
    && (rawQuery !== null || rawTag !== null)
    && isSearchPath(normalizedPathname)
  ) {
    errors.q = 'q is required when tag is not provided.'
  }

  return {
    scope,
    q,
    tag,
    page,
    pageSize,
    sort,
    errors,
  }
}

export function buildSearchRoutePath(input: SearchRouteInput): string {
  const basePath = input.scope === 'items'
    ? routes.searchItems.path
    : routes.searchInventories.path

  const q = input.q === undefined || input.q === null
    ? null
    : normalizeSearchQueryInput(input.q)
  const tag = input.scope === 'items' || input.tag === undefined
    ? null
    : normalizeOptionalText(input.tag, searchRouteContract.maxTagLength)
  const page = input.page !== null && input.page !== undefined && Number.isInteger(input.page) && input.page > 0
    ? input.page
    : searchRouteContract.defaultPage
  const pageSize = input.pageSize !== null
    && input.pageSize !== undefined
    && Number.isInteger(input.pageSize)
    && input.pageSize >= 1
    && input.pageSize <= searchRouteContract.maxPageSize
    ? input.pageSize
    : searchRouteContract.defaultPageSize
  const sort = input.sort === undefined
    ? null
    : normalizeOptionalText(input.sort, Number.MAX_SAFE_INTEGER)

  const searchParams = new URLSearchParams()

  if (q !== null) {
    searchParams.set('q', q)
  }

  if (tag !== null) {
    searchParams.set('tag', tag)
  }

  if (page !== searchRouteContract.defaultPage) {
    searchParams.set('page', String(page))
  }

  if (pageSize !== searchRouteContract.defaultPageSize) {
    searchParams.set('pageSize', String(pageSize))
  }

  if (sort !== null) {
    searchParams.set('sort', sort)
  }

  const queryString = searchParams.toString()
  return queryString.length > 0 ? `${basePath}?${queryString}` : basePath
}

export function createSearchRouteFromIntent(intent: SearchNavigationIntent): string {
  const normalizedQuery = normalizeSearchQueryInput(intent.q)
  if (normalizedQuery === null) {
    throw new Error('Search query must be a non-empty string within the allowed length.')
  }

  return buildSearchRoutePath({
    scope: intent.scope,
    q: normalizedQuery,
    page: searchRouteContract.defaultPage,
  })
}
