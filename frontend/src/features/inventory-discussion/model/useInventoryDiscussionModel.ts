import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createInventoryDiscussionPost,
  normalizeDiscussionPostedEventPayload,
  requestInventoryDiscussionPosts,
  type InventoryDiscussionPostsRequestResult,
  type CreateInventoryDiscussionPostRequestResult,
} from '../../../entities/inventory/model/inventoryDiscussionApi.ts'
import type { InventoryDiscussionPost } from '../../../entities/inventory/model/inventoryDiscussionTypes.ts'

export type InventoryDiscussionStatus = 'idle' | 'loading' | 'ready' | 'error'
export type RealtimeConnectionStatus = 'disconnected' | 'connecting' | 'connected'

type InventoryDiscussionState = {
  status: InventoryDiscussionStatus
  posts: ReadonlyArray<InventoryDiscussionPost>
  hasMoreHistory: boolean
  errorMessage: string | null
  errorStatus: number | null
  isLoadingMore: boolean
  isPosting: boolean
  postErrorMessage: string | null
  realtimeStatus: RealtimeConnectionStatus
  realtimeErrorMessage: string | null
}

export type InventoryDiscussionModel = InventoryDiscussionState & {
  retryLoad: () => void
  loadOlderPosts: () => void
  submitPost: (contentMarkdown: string) => Promise<boolean>
  clearPostError: () => void
}

const initialDiscussionState: InventoryDiscussionState = {
  status: 'idle',
  posts: [],
  hasMoreHistory: false,
  errorMessage: null,
  errorStatus: null,
  isLoadingMore: false,
  isPosting: false,
  postErrorMessage: null,
  realtimeStatus: 'disconnected',
  realtimeErrorMessage: null,
}

const defaultPageLimit = 50
const maxPostLength = 10_000

function comparePostIds(leftId: string, rightId: string): number {
  if (leftId === rightId) {
    return 0
  }

  try {
    return BigInt(leftId) < BigInt(rightId) ? -1 : 1
  } catch {
    return leftId.localeCompare(rightId)
  }
}

function mergePosts(
  currentPosts: ReadonlyArray<InventoryDiscussionPost>,
  incomingPosts: ReadonlyArray<InventoryDiscussionPost>,
): ReadonlyArray<InventoryDiscussionPost> {
  if (incomingPosts.length === 0) {
    return currentPosts
  }

  const postsById = new Map<string, InventoryDiscussionPost>()

  for (const post of currentPosts) {
    postsById.set(post.id, post)
  }

  for (const post of incomingPosts) {
    postsById.set(post.id, post)
  }

  return [...postsById.values()].sort((leftPost, rightPost) => comparePostIds(leftPost.id, rightPost.id))
}

function toListFailureMessage(failure: InventoryDiscussionPostsRequestResult & { ok: false }): string {
  if (failure.status === 404) {
    return 'Inventory discussion was not found.'
  }

  if (failure.status === 400) {
    return failure.message
  }

  if (failure.status === 0) {
    return failure.message.trim().length > 0
      ? failure.message
      : 'Discussion request failed before reaching API.'
  }

  return failure.message
}

function toPostFailureMessage(failure: CreateInventoryDiscussionPostRequestResult & { ok: false }): string {
  if (failure.status === 401) {
    return 'Sign in to publish discussion posts.'
  }

  if (failure.status === 403) {
    return 'You do not have permission to publish discussion posts.'
  }

  if (failure.status === 404) {
    return 'Inventory discussion was not found.'
  }

  if (failure.status === 400) {
    return failure.message
  }

  if (failure.status === 0) {
    return failure.message.trim().length > 0
      ? failure.message
      : 'Post request failed before reaching API.'
  }

  return failure.message
}

function toRealtimeFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim()
  }

  return 'Realtime connection failed.'
}

function toUnexpectedFailureMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim()
  }

  return fallbackMessage
}

export function useInventoryDiscussionModel(
  inventoryId: string | null,
  enabled: boolean,
  canComment: boolean,
): InventoryDiscussionModel {
  const [state, setState] = useState<InventoryDiscussionState>(initialDiscussionState)
  const [reloadToken, setReloadToken] = useState(0)

  const listRequestSequenceRef = useRef(0)
  const listAbortControllerRef = useRef<AbortController | null>(null)
  const loadMoreAbortControllerRef = useRef<AbortController | null>(null)
  const postAbortControllerRef = useRef<AbortController | null>(null)
  const postingInFlightRef = useRef(false)

  const retryLoad = useCallback(() => {
    setReloadToken((currentValue) => currentValue + 1)
  }, [])

  const clearPostError = useCallback(() => {
    setState((currentState) => ({
      ...currentState,
      postErrorMessage: null,
    }))
  }, [])

  useEffect(
    () => () => {
      listAbortControllerRef.current?.abort()
      loadMoreAbortControllerRef.current?.abort()
      postAbortControllerRef.current?.abort()
    },
    [],
  )

  useEffect(() => {
    listAbortControllerRef.current?.abort()

    if (!enabled || inventoryId === null) {
      return
    }

    listRequestSequenceRef.current += 1
    const requestId = listRequestSequenceRef.current

    const abortController = new AbortController()
    listAbortControllerRef.current = abortController

    setState((currentState) => ({
      ...currentState,
      status: 'loading',
      errorMessage: null,
      errorStatus: null,
      postErrorMessage: null,
      posts: [],
      hasMoreHistory: false,
      isLoadingMore: false,
    }))

    void (async () => {
      const response = await requestInventoryDiscussionPosts(
        inventoryId,
        { limit: defaultPageLimit },
        abortController.signal,
      )

      if (abortController.signal.aborted || requestId !== listRequestSequenceRef.current) {
        return
      }

      if (!response.ok) {
        setState((currentState) => ({
          ...currentState,
          status: 'error',
          errorMessage: toListFailureMessage(response),
          errorStatus: response.status,
          posts: [],
          hasMoreHistory: false,
        }))
        return
      }

      setState((currentState) => ({
        ...currentState,
        status: 'ready',
        posts: mergePosts([], response.data.posts),
        hasMoreHistory: response.data.hasMore,
        errorMessage: null,
        errorStatus: null,
      }))
    })()

    return () => {
      abortController.abort()
    }
  }, [enabled, inventoryId, reloadToken])

  const loadOlderPosts = useCallback(() => {
    if (!enabled || inventoryId === null) {
      return
    }

    setState((currentState) => {
      if (currentState.isLoadingMore || !currentState.hasMoreHistory || currentState.posts.length === 0) {
        return currentState
      }

      loadMoreAbortControllerRef.current?.abort()
      const abortController = new AbortController()
      loadMoreAbortControllerRef.current = abortController
      const oldestPostId = currentState.posts[0].id

      void (async () => {
        const response = await requestInventoryDiscussionPosts(
          inventoryId,
          {
            beforeId: oldestPostId,
            limit: defaultPageLimit,
          },
          abortController.signal,
        )

        if (abortController.signal.aborted) {
          return
        }

        if (!response.ok) {
          setState((snapshot) => ({
            ...snapshot,
            isLoadingMore: false,
            errorMessage: toListFailureMessage(response),
            errorStatus: response.status,
          }))
          return
        }

        setState((snapshot) => ({
          ...snapshot,
          status: 'ready',
          isLoadingMore: false,
          posts: mergePosts(snapshot.posts, response.data.posts),
          hasMoreHistory: response.data.hasMore,
          errorMessage: null,
          errorStatus: null,
        }))
      })()

      return {
        ...currentState,
        isLoadingMore: true,
      }
    })
  }, [enabled, inventoryId])

  const submitPost = useCallback(
    async (contentMarkdown: string): Promise<boolean> => {
      if (!enabled || inventoryId === null) {
        return false
      }

      if (!canComment) {
        setState((currentState) => ({
          ...currentState,
          postErrorMessage: 'Only authenticated users can publish discussion posts.',
        }))
        return false
      }

      if (postingInFlightRef.current) {
        return false
      }

      const normalizedContent = contentMarkdown.trim()
      if (normalizedContent.length === 0) {
        setState((currentState) => ({
          ...currentState,
          postErrorMessage: 'contentMarkdown is required.',
        }))
        return false
      }

      if (normalizedContent.length > maxPostLength) {
        setState((currentState) => ({
          ...currentState,
          postErrorMessage: `contentMarkdown must be ${String(maxPostLength)} characters or less.`,
        }))
        return false
      }

      setState((currentState) => {
        return {
          ...currentState,
          isPosting: true,
          postErrorMessage: null,
        }
      })

      postingInFlightRef.current = true

      postAbortControllerRef.current?.abort()
      const abortController = new AbortController()
      postAbortControllerRef.current = abortController

      try {
        const response = await createInventoryDiscussionPost(inventoryId, normalizedContent, abortController.signal)

        if (abortController.signal.aborted) {
          setState((currentState) => ({
            ...currentState,
            isPosting: false,
          }))
          return false
        }

        if (!response.ok) {
          setState((currentState) => ({
            ...currentState,
            isPosting: false,
            postErrorMessage: toPostFailureMessage(response),
          }))
          return false
        }

        setState((currentState) => ({
          ...currentState,
          status: 'ready',
          isPosting: false,
          postErrorMessage: null,
          posts: mergePosts(currentState.posts, [response.data]),
        }))

        return true
      } catch (error) {
        setState((currentState) => ({
          ...currentState,
          isPosting: false,
          postErrorMessage: toUnexpectedFailureMessage(error, 'Failed to publish discussion post.'),
        }))
        return false
      } finally {
        postingInFlightRef.current = false
      }
    },
    [canComment, enabled, inventoryId],
  )

  useEffect(() => {
    if (!enabled || inventoryId === null) {
      return
    }

    let isDisposed = false

    const connection = new HubConnectionBuilder()
      .withUrl('/hubs/discussions', {
        withCredentials: true,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(LogLevel.Warning)
      .build()

    const handlePostedPayload = (payload: unknown) => {
      const postedEvent = normalizeDiscussionPostedEventPayload(payload)
      if (postedEvent === null || postedEvent.inventoryId !== inventoryId || isDisposed) {
        return
      }

      setState((currentState) => ({
        ...currentState,
        posts: mergePosts(currentState.posts, [postedEvent.post]),
      }))
    }

    connection.on('discussion.posted', handlePostedPayload)

    connection.onreconnecting((error) => {
      if (isDisposed) {
        return
      }

      setState((currentState) => ({
        ...currentState,
        realtimeStatus: 'connecting',
        realtimeErrorMessage: error === undefined ? null : toRealtimeFailureMessage(error),
      }))
    })

    connection.onreconnected(async () => {
      if (isDisposed) {
        return
      }

      try {
        await connection.invoke('JoinInventoryDiscussion', inventoryId)

        if (isDisposed) {
          return
        }

        setState((currentState) => ({
          ...currentState,
          realtimeStatus: 'connected',
          realtimeErrorMessage: null,
        }))
      } catch (error) {
        if (isDisposed) {
          return
        }

        setState((currentState) => ({
          ...currentState,
          realtimeStatus: 'disconnected',
          realtimeErrorMessage: toRealtimeFailureMessage(error),
        }))
      }
    })

    connection.onclose((error) => {
      if (isDisposed) {
        return
      }

      setState((currentState) => ({
        ...currentState,
        realtimeStatus: 'disconnected',
        realtimeErrorMessage: error === undefined ? null : toRealtimeFailureMessage(error),
      }))
    })

    setState((currentState) => ({
      ...currentState,
      realtimeStatus: 'connecting',
      realtimeErrorMessage: null,
    }))

    void (async () => {
      try {
        await connection.start()
        await connection.invoke('JoinInventoryDiscussion', inventoryId)

        if (isDisposed) {
          return
        }

        setState((currentState) => ({
          ...currentState,
          realtimeStatus: 'connected',
          realtimeErrorMessage: null,
        }))
      } catch (error) {
        if (isDisposed) {
          return
        }

        setState((currentState) => ({
          ...currentState,
          realtimeStatus: 'disconnected',
          realtimeErrorMessage: toRealtimeFailureMessage(error),
        }))
      }
    })()

    return () => {
      isDisposed = true
      connection.off('discussion.posted', handlePostedPayload)

      void (async () => {
        if (connection.state === HubConnectionState.Connected) {
          try {
            await connection.invoke('LeaveInventoryDiscussion', inventoryId)
          } catch {
            // Swallow cleanup errors: component is unmounting.
          }
        }

        try {
          await connection.stop()
        } catch {
          // Swallow cleanup errors: component is unmounting.
        }
      })()
    }
  }, [enabled, inventoryId])

  return useMemo(
    () => ({
      ...state,
      retryLoad,
      loadOlderPosts,
      submitPost,
      clearPostError,
    }),
    [clearPostError, loadOlderPosts, retryLoad, state, submitPost],
  )
}
