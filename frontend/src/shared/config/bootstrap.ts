export interface AppBootstrapConfig {
  apiBaseUrl: string
}

const DEFAULT_API_BASE_URL = '/api/v1'

function trimTrailingSlash(value: string): string {
  if (value.length > 1) {
    return value.replace(/\/+$/, '')
  }

  return value
}

function normalizePathBaseUrl(value: string): string {
  const normalized = trimTrailingSlash(value)

  if (!normalized.startsWith('/')) {
    throw new Error('VITE_API_BASE_URL must start with "/" when path-based.')
  }

  if (normalized === '/') {
    throw new Error('VITE_API_BASE_URL cannot be "/". Use "/api/v1" or a full URL.')
  }

  return normalized
}

function normalizeAbsoluteBaseUrl(value: string): string {
  let parsedUrl: URL

  try {
    parsedUrl = new URL(value)
  } catch {
    throw new Error('VITE_API_BASE_URL must be an absolute URL or "/api/v1"-style path.')
  }

  if (parsedUrl.search.length > 0 || parsedUrl.hash.length > 0) {
    throw new Error('VITE_API_BASE_URL must not include query or hash.')
  }

  const normalizedPath = trimTrailingSlash(parsedUrl.pathname || '/')

  if (normalizedPath === '/') {
    throw new Error('VITE_API_BASE_URL absolute URL must include API path, for example "/api/v1".')
  }

  return `${parsedUrl.origin}${normalizedPath}`
}

function normalizeApiBaseUrl(value: string): string {
  if (value.startsWith('/')) {
    return normalizePathBaseUrl(value)
  }

  return normalizeAbsoluteBaseUrl(value)
}

export function createAppBootstrapConfig(env: ImportMetaEnv): AppBootstrapConfig {
  const configuredBaseUrl = env.VITE_API_BASE_URL?.trim()
  const apiBaseUrl = configuredBaseUrl && configuredBaseUrl.length > 0
    ? configuredBaseUrl
    : DEFAULT_API_BASE_URL

  return {
    apiBaseUrl: normalizeApiBaseUrl(apiBaseUrl),
  }
}
