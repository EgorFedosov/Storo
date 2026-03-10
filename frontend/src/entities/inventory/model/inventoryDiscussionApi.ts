import { apiRequest } from '../../../shared/api/httpClient.ts'
import type {
  InventoryDiscussionPostedEvent,
  InventoryDiscussionPost,
  InventoryDiscussionPostsPage,
} from './inventoryDiscussionTypes.ts'

type InventoryDiscussionRequestFailure = {
  ok: false
  status: number
  message: string
  validationErrors: Record<string, string[]>
}

type InventoryDiscussionPostsSuccess = {
  ok: true
  data: InventoryDiscussionPostsPage
}

type InventoryDiscussionPostSuccess = {
  ok: true
  data: InventoryDiscussionPost
}

export type InventoryDiscussionPostsRequestResult = InventoryDiscussionPostsSuccess | InventoryDiscussionRequestFailure
export type CreateInventoryDiscussionPostRequestResult = InventoryDiscussionPostSuccess | InventoryDiscussionRequestFailure

export type InventoryDiscussionPostsQuery = {
  afterId?: string | null
  beforeId?: string | null
  limit?: number
}

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

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function normalizeStringId(value: unknown): string | null {
  const normalizedValue = normalizeNonEmptyString(value)
  if (normalizedValue === null || !/^\d+$/.test(normalizedValue)) {
    return null
  }

  return normalizedValue
}

function normalizeIsoDate(value: unknown): string | null {
  const normalizedValue = normalizeNonEmptyString(value)
  if (normalizedValue === null) {
    return null
  }

  return Number.isNaN(Date.parse(normalizedValue)) ? null : normalizedValue
}

function normalizeDiscussionPostAuthor(payload: unknown): InventoryDiscussionPost['author'] | null {
  if (!isRecord(payload)) {
    return null
  }

  const id = normalizeStringId(payload.id)
  const userName = normalizeNonEmptyString(payload.userName)
  const displayName = normalizeNonEmptyString(payload.displayName)

  if (id === null || userName === null || displayName === null) {
    return null
  }

  return {
    id,
    userName,
    displayName,
  }
}

function normalizeDiscussionPost(payload: unknown): InventoryDiscussionPost | null {
  if (!isRecord(payload)) {
    return null
  }

  const id = normalizeStringId(payload.id)
  const contentMarkdown = normalizeString(payload.contentMarkdown)
  const createdAt = normalizeIsoDate(payload.createdAt)
  const author = normalizeDiscussionPostAuthor(payload.author)

  if (id === null || contentMarkdown === null || createdAt === null || author === null) {
    return null
  }

  return {
    id,
    contentMarkdown,
    createdAt,
    author,
  }
}

function normalizeDiscussionPostsPage(payload: unknown): InventoryDiscussionPostsPage | null {
  if (!isRecord(payload) || !Array.isArray(payload.posts) || typeof payload.hasMore !== 'boolean') {
    return null
  }

  const inventoryId = normalizeStringId(payload.inventoryId)
  if (inventoryId === null) {
    return null
  }

  const posts: InventoryDiscussionPost[] = []
  const seenIds = new Set<string>()

  for (const rawPost of payload.posts) {
    const post = normalizeDiscussionPost(rawPost)
    if (post === null || seenIds.has(post.id)) {
      return null
    }

    seenIds.add(post.id)
    posts.push(post)
  }

  return {
    inventoryId,
    posts,
    hasMore: payload.hasMore,
  }
}

function pickFirstValidationError(validationErrors: Record<string, string[]>): string | null {
  for (const errors of Object.values(validationErrors)) {
    if (errors.length > 0) {
      return errors[0]
    }
  }

  return null
}

function toFailure(
  status: number,
  message: string,
  validationErrors: Record<string, string[]>,
): InventoryDiscussionRequestFailure {
  return {
    ok: false,
    status,
    message,
    validationErrors,
  }
}

function normalizeQuery(query: InventoryDiscussionPostsQuery): Record<string, number | string> {
  const normalizedQuery: Record<string, number | string> = {}

  if (query.afterId !== undefined && query.afterId !== null) {
    const normalizedAfterId = query.afterId.trim()
    if (normalizedAfterId.length > 0) {
      normalizedQuery.afterId = normalizedAfterId
    }
  }

  if (query.beforeId !== undefined && query.beforeId !== null) {
    const normalizedBeforeId = query.beforeId.trim()
    if (normalizedBeforeId.length > 0) {
      normalizedQuery.beforeId = normalizedBeforeId
    }
  }

  if (typeof query.limit === 'number' && Number.isInteger(query.limit)) {
    normalizedQuery.limit = query.limit
  }

  return normalizedQuery
}

export function normalizeDiscussionPostedEventPayload(payload: unknown): InventoryDiscussionPostedEvent | null {
  if (!isRecord(payload)) {
    return null
  }

  if (payload.event !== 'discussion.posted') {
    return null
  }

  const inventoryId = normalizeStringId(payload.inventoryId)
  const post = normalizeDiscussionPost(payload.post)

  if (inventoryId === null || post === null) {
    return null
  }

  return {
    event: 'discussion.posted',
    inventoryId,
    post,
  }
}

export async function requestInventoryDiscussionPosts(
  inventoryId: string,
  query: InventoryDiscussionPostsQuery,
  signal: AbortSignal,
): Promise<InventoryDiscussionPostsRequestResult> {
  const response = await apiRequest<unknown>(`/inventories/${inventoryId}/discussion/posts`, {
    signal,
    query: normalizeQuery(query),
  })

  if (!response.ok) {
    const validationErrors = response.problem?.errors ?? {}
    const firstValidationError = pickFirstValidationError(validationErrors)

    return toFailure(
      response.status,
      firstValidationError ?? response.error.message,
      validationErrors,
    )
  }

  const normalizedPayload = normalizeDiscussionPostsPage(response.data)
  if (normalizedPayload === null) {
    return toFailure(
      response.status,
      'Received invalid response format from /inventories/{id}/discussion/posts.',
      {},
    )
  }

  return {
    ok: true,
    data: normalizedPayload,
  }
}

export async function createInventoryDiscussionPost(
  inventoryId: string,
  contentMarkdown: string,
  signal: AbortSignal,
): Promise<CreateInventoryDiscussionPostRequestResult> {
  const response = await apiRequest<unknown>(`/inventories/${inventoryId}/discussion/posts`, {
    method: 'POST',
    signal,
    body: {
      contentMarkdown,
    },
  })

  if (!response.ok) {
    const validationErrors = response.problem?.errors ?? {}
    const firstValidationError = pickFirstValidationError(validationErrors)

    return toFailure(
      response.status,
      firstValidationError ?? response.error.message,
      validationErrors,
    )
  }

  const normalizedPayload = normalizeDiscussionPost(response.data)
  if (normalizedPayload === null) {
    return toFailure(
      response.status,
      'Received invalid response format from POST /inventories/{id}/discussion/posts.',
      {},
    )
  }

  return {
    ok: true,
    data: normalizedPayload,
  }
}
