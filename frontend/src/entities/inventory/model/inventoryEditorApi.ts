import { extractVersionStamp, normalizeETag, type VersionStamp } from '../../../shared/api/concurrency.ts'
import { apiRequest, type ApiRequestOptions, type ApiResult } from '../../../shared/api/httpClient.ts'
import type { InventoryEditor, InventoryEditorCustomField, InventoryEditorCustomIdTemplatePart } from './inventoryEditorTypes.ts'

type InventoryEditorFailure = {
  ok: false
  status: number
  message: string
  validationErrors: Record<string, string[]>
}

type InventoryEditorSuccess = {
  ok: true
  data: InventoryEditor
  etag: string | null
  versionStamp: VersionStamp
}

export type InventoryEditorRequestResult = InventoryEditorSuccess | InventoryEditorFailure

export const inventoryEditorTagsContract = {
  maxTagLength: 100,
} as const

export type UpdateInventorySettingsPayload = {
  title: string
  descriptionMarkdown: string
  categoryId: number
  imageUrl: string | null
}

export type ReplaceInventoryAccessPayload = {
  mode: 'public' | 'restricted'
  writerUserIds: ReadonlyArray<string>
}

export type InventoryVersionPayload = {
  version: number
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

function normalizeOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }

  return normalizeString(value)
}

function normalizePositiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

function normalizeStringId(value: unknown): string | null {
  const normalizedValue = normalizeNonEmptyString(value)
  if (normalizedValue === null || !/^\d+$/.test(normalizedValue)) {
    return null
  }

  return normalizedValue
}

function normalizeSettings(payload: unknown): InventoryEditor['settings'] | null {
  if (!isRecord(payload)) {
    return null
  }

  const title = normalizeNonEmptyString(payload.title)
  const descriptionMarkdown = normalizeString(payload.descriptionMarkdown)
  const imageUrl = normalizeOptionalString(payload.imageUrl)

  if (title === null || descriptionMarkdown === null) {
    return null
  }

  const category = payload.category
  if (!isRecord(category)) {
    return null
  }

  const categoryId = normalizePositiveInteger(category.id)
  const categoryName = normalizeNonEmptyString(category.name)
  if (categoryId === null || categoryName === null) {
    return null
  }

  return {
    title,
    descriptionMarkdown,
    category: {
      id: categoryId,
      name: categoryName,
    },
    imageUrl,
  }
}

function normalizeTags(payload: unknown): InventoryEditor['tags'] | null {
  if (!Array.isArray(payload)) {
    return null
  }

  const normalizedTags: Array<InventoryEditor['tags'][number]> = []
  const seenTagIds = new Set<string>()

  for (const rawTag of payload) {
    if (!isRecord(rawTag)) {
      return null
    }

    const id = normalizeStringId(rawTag.id)
    const name = normalizeNonEmptyString(rawTag.name)

    if (id === null || name === null || seenTagIds.has(id)) {
      return null
    }

    seenTagIds.add(id)
    normalizedTags.push({ id, name })
  }

  return normalizedTags
}

function normalizeAccess(payload: unknown): InventoryEditor['access'] | null {
  if (!isRecord(payload)) {
    return null
  }

  const mode = payload.mode === 'public' || payload.mode === 'restricted'
    ? payload.mode
    : null
  if (mode === null || !Array.isArray(payload.writers)) {
    return null
  }

  const writers = payload.writers
  const normalizedWriters: Array<InventoryEditor['access']['writers'][number]> = []
  const seenWriterIds = new Set<string>()

  for (const rawWriter of writers) {
    if (!isRecord(rawWriter)) {
      return null
    }

    const id = normalizeStringId(rawWriter.id)
    const userName = normalizeNonEmptyString(rawWriter.userName)
    const displayName = normalizeNonEmptyString(rawWriter.displayName)
    const email = normalizeNonEmptyString(rawWriter.email)
    const isBlocked = typeof rawWriter.isBlocked === 'boolean' ? rawWriter.isBlocked : null

    if (
      id === null
      || userName === null
      || displayName === null
      || email === null
      || isBlocked === null
      || seenWriterIds.has(id)
    ) {
      return null
    }

    seenWriterIds.add(id)
    normalizedWriters.push({
      id,
      userName,
      displayName,
      email,
      isBlocked,
    })
  }

  return {
    mode,
    writers: normalizedWriters,
  }
}

function normalizeCustomFieldType(value: unknown): InventoryEditorCustomField['fieldType'] | null {
  if (
    value === 'single_line'
    || value === 'multi_line'
    || value === 'number'
    || value === 'link'
    || value === 'bool'
  ) {
    return value
  }

  return null
}

function normalizeCustomFields(payload: unknown): InventoryEditor['customFields'] | null {
  if (!Array.isArray(payload)) {
    return null
  }

  const normalizedFields: Array<InventoryEditor['customFields'][number]> = []
  const seenFieldIds = new Set<string>()

  for (const rawField of payload) {
    if (!isRecord(rawField)) {
      return null
    }

    const id = normalizeStringId(rawField.id)
    const fieldType = normalizeCustomFieldType(rawField.fieldType)
    const title = normalizeNonEmptyString(rawField.title)
    const description = normalizeString(rawField.description)
    const showInTable = typeof rawField.showInTable === 'boolean' ? rawField.showInTable : null

    if (
      id === null
      || fieldType === null
      || title === null
      || description === null
      || showInTable === null
      || seenFieldIds.has(id)
    ) {
      return null
    }

    seenFieldIds.add(id)
    normalizedFields.push({
      id,
      fieldType,
      title,
      description,
      showInTable,
    })
  }

  return normalizedFields
}

function normalizeCustomIdPartType(value: unknown): InventoryEditorCustomIdTemplatePart['partType'] | null {
  if (
    value === 'fixed_text'
    || value === 'random_20_bit'
    || value === 'random_32_bit'
    || value === 'random_6_digit'
    || value === 'random_9_digit'
    || value === 'guid'
    || value === 'datetime'
    || value === 'sequence'
  ) {
    return value
  }

  return null
}

function normalizeCustomIdParts(payload: unknown): InventoryEditor['customIdTemplate']['parts'] | null {
  if (!Array.isArray(payload)) {
    return null
  }

  const normalizedParts: Array<InventoryEditor['customIdTemplate']['parts'][number]> = []
  const seenPartIds = new Set<string>()

  for (const rawPart of payload) {
    if (!isRecord(rawPart)) {
      return null
    }

    const id = normalizeStringId(rawPart.id)
    const partType = normalizeCustomIdPartType(rawPart.partType)
    const fixedText = normalizeOptionalString(rawPart.fixedText)
    const formatPattern = normalizeOptionalString(rawPart.formatPattern)

    if (id === null || partType === null || seenPartIds.has(id)) {
      return null
    }

    seenPartIds.add(id)
    normalizedParts.push({
      id,
      partType,
      fixedText,
      formatPattern,
    })
  }

  return normalizedParts
}

function normalizePreview(payload: unknown): InventoryEditor['customIdTemplate']['preview'] | null {
  if (!isRecord(payload) || !Array.isArray(payload.warnings)) {
    return null
  }

  const sampleCustomId = normalizeString(payload.sampleCustomId)
  if (sampleCustomId === null) {
    return null
  }

  const warnings: string[] = []
  for (const rawWarning of payload.warnings) {
    const warning = normalizeNonEmptyString(rawWarning)
    if (warning === null) {
      return null
    }

    warnings.push(warning)
  }

  return {
    sampleCustomId,
    warnings,
  }
}

function normalizeCustomIdTemplate(payload: unknown): InventoryEditor['customIdTemplate'] | null {
  if (!isRecord(payload)) {
    return null
  }

  const isEnabled = typeof payload.isEnabled === 'boolean' ? payload.isEnabled : null
  const parts = normalizeCustomIdParts(payload.parts)
  const derivedValidationRegex = normalizeOptionalString(payload.derivedValidationRegex)
  const preview = normalizePreview(payload.preview)

  if (isEnabled === null || parts === null || preview === null) {
    return null
  }

  return {
    isEnabled,
    parts,
    derivedValidationRegex,
    preview,
  }
}

function normalizePermissions(payload: unknown): InventoryEditor['permissions'] | null {
  if (!isRecord(payload)) {
    return null
  }

  const {
    canEditInventory,
    canManageAccess,
    canManageCustomFields,
    canManageCustomIdTemplate,
    canWriteItems,
  } = payload

  if (
    typeof canEditInventory !== 'boolean'
    || typeof canManageAccess !== 'boolean'
    || typeof canManageCustomFields !== 'boolean'
    || typeof canManageCustomIdTemplate !== 'boolean'
    || typeof canWriteItems !== 'boolean'
  ) {
    return null
  }

  return {
    canEditInventory,
    canManageAccess,
    canManageCustomFields,
    canManageCustomIdTemplate,
    canWriteItems,
  }
}

function normalizeInventoryEditorPayload(payload: unknown): InventoryEditor | null {
  if (!isRecord(payload)) {
    return null
  }

  const id = normalizeStringId(payload.id)
  const version = normalizePositiveInteger(payload.version)
  const settings = normalizeSettings(payload.settings)
  const tags = normalizeTags(payload.tags)
  const access = normalizeAccess(payload.access)
  const customFields = normalizeCustomFields(payload.customFields)
  const customIdTemplate = normalizeCustomIdTemplate(payload.customIdTemplate)
  const permissions = normalizePermissions(payload.permissions)

  if (
    id === null
    || version === null
    || settings === null
    || tags === null
    || access === null
    || customFields === null
    || customIdTemplate === null
    || permissions === null
  ) {
    return null
  }

  return {
    id,
    version,
    settings,
    tags,
    access,
    customFields,
    customIdTemplate,
    permissions,
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

function normalizeInventoryVersionPayload(payload: unknown): InventoryVersionPayload | null {
  if (!isRecord(payload)) {
    return null
  }

  const version = normalizePositiveInteger(payload.version)
  if (version === null) {
    return null
  }

  return { version }
}

export async function requestInventoryEditor(
  inventoryId: string,
  signal: AbortSignal,
): Promise<InventoryEditorRequestResult> {
  const response = await apiRequest<unknown>(`/inventories/${inventoryId}/edit`, {
    signal,
  })

  if (!response.ok) {
    const validationErrors = response.problem?.errors ?? {}
    const firstValidationError = pickFirstValidationError(validationErrors)

    return {
      ok: false,
      status: response.status,
      message: firstValidationError ?? response.error.message,
      validationErrors,
    }
  }

  const normalizedPayload = normalizeInventoryEditorPayload(response.data)
  if (normalizedPayload === null) {
    return {
      ok: false,
      status: response.status,
      message: 'Received invalid response format from /inventories/{id}/edit.',
      validationErrors: {},
    }
  }

  const versionStamp = extractVersionStamp(response)
  if (versionStamp === null) {
    return {
      ok: false,
      status: response.status,
      message: 'Missing version/ETag in /inventories/{id}/edit response.',
      validationErrors: {},
    }
  }

  return {
    ok: true,
    data: normalizedPayload,
    etag: normalizeETag(response.meta.etag),
    versionStamp,
  }
}

export async function updateInventorySettings(
  inventoryId: string,
  payload: UpdateInventorySettingsPayload,
  options: ApiRequestOptions = {},
): Promise<ApiResult<InventoryVersionPayload>> {
  const response = await apiRequest<unknown>(`/inventories/${inventoryId}/settings`, {
    ...options,
    method: 'PUT',
    body: payload,
  })

  if (!response.ok) {
    return response
  }

  const normalizedPayload = normalizeInventoryVersionPayload(response.data)
  if (normalizedPayload === null) {
    return {
      ok: false,
      status: response.status,
      problem: null,
      error: {
        kind: 'invalid_json',
        message: 'Received invalid response format from /inventories/{id}/settings.',
        problem: null,
      },
      meta: response.meta,
    }
  }

  return {
    ...response,
    data: normalizedPayload,
  }
}

export async function replaceInventoryTags(
  inventoryId: string,
  tags: ReadonlyArray<string>,
  options: ApiRequestOptions = {},
): Promise<ApiResult<InventoryVersionPayload>> {
  const response = await apiRequest<unknown>(`/inventories/${inventoryId}/tags`, {
    ...options,
    method: 'PUT',
    body: {
      tags: [...tags],
    },
  })

  if (!response.ok) {
    return response
  }

  const normalizedPayload = normalizeInventoryVersionPayload(response.data)
  if (normalizedPayload === null) {
    return {
      ok: false,
      status: response.status,
      problem: null,
      error: {
        kind: 'invalid_json',
        message: 'Received invalid response format from /inventories/{id}/tags.',
        problem: null,
      },
      meta: response.meta,
    }
  }

  return {
    ...response,
    data: normalizedPayload,
  }
}

export async function replaceInventoryAccess(
  inventoryId: string,
  payload: ReplaceInventoryAccessPayload,
  options: ApiRequestOptions = {},
): Promise<ApiResult<InventoryVersionPayload>> {
  const response = await apiRequest<unknown>(`/inventories/${inventoryId}/access`, {
    ...options,
    method: 'PUT',
    body: {
      mode: payload.mode,
      writerUserIds: [...payload.writerUserIds],
    },
  })

  if (!response.ok) {
    return response
  }

  const normalizedPayload = normalizeInventoryVersionPayload(response.data)
  if (normalizedPayload === null) {
    return {
      ok: false,
      status: response.status,
      problem: null,
      error: {
        kind: 'invalid_json',
        message: 'Received invalid response format from /inventories/{id}/access.',
        problem: null,
      },
      meta: response.meta,
    }
  }

  return {
    ...response,
    data: normalizedPayload,
  }
}

export async function deleteInventory(
  inventoryId: string,
  options: ApiRequestOptions = {},
): Promise<ApiResult<null>> {
  const response = await apiRequest<unknown>(`/inventories/${inventoryId}`, {
    ...options,
    method: 'DELETE',
  })

  if (!response.ok) {
    return response
  }

  return {
    ...response,
    data: null,
  }
}
