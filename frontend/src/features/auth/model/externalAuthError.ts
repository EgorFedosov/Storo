export type ExternalAuthErrorCode =
  | 'external_auth_failed'
  | 'external_provider_unavailable'
  | 'missing_external_identity'
  | 'user_blocked'

export type ExternalAuthErrorPresentation = {
  title: string
  description: string
  retryAllowed: boolean
}

const externalAuthErrorPresentationMap: Record<ExternalAuthErrorCode, ExternalAuthErrorPresentation> = {
  external_auth_failed: {
    title: 'Social login was not completed',
    description: 'The provider authentication flow failed. Please try again.',
    retryAllowed: true,
  },
  external_provider_unavailable: {
    title: 'Provider is unavailable',
    description: 'Selected social provider is not configured right now.',
    retryAllowed: false,
  },
  missing_external_identity: {
    title: 'Provider did not return required identity data',
    description: 'The provider response is missing required fields. Try another account.',
    retryAllowed: true,
  },
  user_blocked: {
    title: 'Account is blocked',
    description: 'Sign-in succeeded, but this user is blocked and cannot open an active session.',
    retryAllowed: false,
  },
}

function normalizeCode(value: string | null): string | null {
  if (value === null) {
    return null
  }

  const normalizedValue = value.trim().toLowerCase()
  return normalizedValue.length > 0 ? normalizedValue : null
}

export function resolveExternalAuthErrorCode(search: string): string | null {
  const searchParams = new URLSearchParams(search)
  return normalizeCode(searchParams.get('code'))
}

export function getExternalAuthErrorPresentation(code: string | null): ExternalAuthErrorPresentation {
  if (code === null) {
    return {
      title: 'Social login returned an error',
      description: 'No error code was provided by the backend redirect.',
      retryAllowed: true,
    }
  }

  return externalAuthErrorPresentationMap[code as ExternalAuthErrorCode] ?? {
    title: 'Social login returned an unknown error',
    description: 'Backend returned an unsupported error code. Check server configuration.',
    retryAllowed: true,
  }
}
