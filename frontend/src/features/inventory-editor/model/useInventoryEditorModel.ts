import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  deleteInventory as requestDeleteInventory,
  inventoryEditorTagsContract,
  replaceInventoryTags,
  requestInventoryEditor,
  updateInventorySettings,
  type InventoryEditorRequestResult,
} from '../../../entities/inventory/model/inventoryEditorApi.ts'
import {
  previewInventoryCustomIdTemplate,
  saveInventoryCustomIdTemplate,
  type InventoryCustomIdTemplateMutationPayload,
  type InventoryCustomIdTemplateMutationResponse,
} from '../../../entities/inventory/model/customIdTemplateApi.ts'
import {
  replaceInventoryCustomFields,
  type ReplaceInventoryCustomFieldsRequestPayload,
} from '../../../entities/inventory/model/inventoryCustomFieldsApi.ts'
import {
  deleteInventoryFile,
  uploadInventoryFile,
} from '../../../entities/inventory/model/inventoryImageUploadApi.ts'
import type {
  InventoryCustomFieldType,
  InventoryCustomIdPartType,
  InventoryEditor,
  InventoryEditorCustomField,
} from '../../../entities/inventory/model/inventoryEditorTypes.ts'
import type { InventoryCategoryOption } from '../../../entities/reference/model/types.ts'
import { useSystemReferences } from '../../../entities/reference/model/useSystemReferences.ts'
import { getConcurrencyProblem, type ConcurrencyProblem } from '../../../shared/api/concurrency.ts'
import type { ApiFailure } from '../../../shared/api/httpClient.ts'
import { useVersionedMutationModel } from '../../../shared/ui/model/useVersionedMutationModel.ts'

export type InventoryEditorStatus = 'idle' | 'loading' | 'ready' | 'error'
export type InventoryEditorTabKey = 'settings' | 'tags' | 'access' | 'customFields' | 'customIdTemplate'
export type InventoryEditorTabState = { key: InventoryEditorTabKey; label: string; disabled: boolean }

export type InventoryEditorSettingsField = 'title' | 'descriptionMarkdown' | 'categoryId' | 'imageUrl'
export type InventoryEditorSettingsDraft = {
  title: string
  descriptionMarkdown: string
  categoryId: number | null
  imageUrl: string
}
type InventoryEditorSettingsFieldErrors = Partial<Record<InventoryEditorSettingsField, string[]>>
export type InventorySettingsImageUploadStatus = 'idle' | 'uploading' | 'deleting' | 'success' | 'error'
export type InventorySettingsImageUploadState = {
  status: InventorySettingsImageUploadStatus
  fileName: string | null
  progressPercent: number | null
  errorMessage: string | null
  uploadedPublicUrl: string | null
  expiresAtUtc: string | null
}

export type InventorySettingsAutosaveState = {
  draft: InventoryEditorSettingsDraft | null
  dirtyFields: ReadonlyArray<InventoryEditorSettingsField>
  fieldErrors: InventoryEditorSettingsFieldErrors
  isDirty: boolean
  isSaving: boolean
  isQueued: boolean
  canAutosave: boolean
  lastSavedAt: string | null
  errorMessage: string | null
  autosaveIntervalMs: number
  imageUpload: InventorySettingsImageUploadState
}

export type InventoryTagsAutosaveState = {
  draft: ReadonlyArray<string>
  fieldErrors: Record<string, string[]>
  isDirty: boolean
  isSaving: boolean
  isQueued: boolean
  canAutosave: boolean
  lastSavedAt: string | null
  errorMessage: string | null
  autosaveIntervalMs: number
}

export type InventoryDeleteState = {
  isDeleting: boolean
  errorMessage: string | null
}

export type CustomFieldsAutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'conflict'
export type InventoryEditorCustomFieldDraft = {
  key: string
  id: string | null
  fieldType: InventoryCustomFieldType
  title: string
  description: string
  showInTable: boolean
}
export type InventoryEditorCustomFieldDraftErrors = {
  title: string | null
  description: string | null
}

export type CustomIdTemplateDraftPart = {
  clientId: string
  partType: InventoryCustomIdPartType
  fixedText: string
  formatPattern: string
}
export type InventoryCustomIdTemplateBuilderModel = {
  isEnabled: boolean
  parts: ReadonlyArray<CustomIdTemplateDraftPart>
  selectedPartId: string | null
  derivedValidationRegex: string | null
  previewSampleCustomId: string
  previewWarnings: ReadonlyArray<string>
  validationErrors: Record<string, string[]>
  previewErrorMessage: string | null
  saveErrorMessage: string | null
  concurrencyProblem: ConcurrencyProblem | null
  isPreviewing: boolean
  isSaving: boolean
  isDirty: boolean
  setIsEnabled: (nextValue: boolean) => void
  selectPart: (partId: string | null) => void
  addPart: (partType: InventoryCustomIdPartType) => void
  updatePartType: (partId: string, nextType: InventoryCustomIdPartType) => void
  updatePartFixedText: (partId: string, nextValue: string) => void
  updatePartFormatPattern: (partId: string, nextValue: string) => void
  moveSelectedPartUp: () => void
  moveSelectedPartDown: () => void
  removeSelectedPart: () => void
  resetDraft: () => void
  previewTemplate: () => Promise<void>
  saveTemplate: () => Promise<void>
}

export const inventoryCustomFieldsAutosaveContract = {
  autosaveDelayMs: 8_000,
  maxTitleLength: 200,
  maxDescriptionLength: 2_000,
  maxFieldsPerType: 3,
} as const

type InventoryEditorState = {
  status: InventoryEditorStatus
  editor: InventoryEditor | null
  errorMessage: string | null
  errorStatus: number | null
}

type CustomFieldsValidationState = {
  byFieldKey: Record<string, InventoryEditorCustomFieldDraftErrors>
  globalErrors: string[]
  hasErrors: boolean
  firstErrorMessage: string | null
}

type CustomFieldsEditorState = {
  draftFields: ReadonlyArray<InventoryEditorCustomFieldDraft>
  persistedFields: ReadonlyArray<InventoryEditorCustomFieldDraft>
  selectedFieldKey: string | null
  validation: CustomFieldsValidationState
  isDirty: boolean
  saveStatus: CustomFieldsAutosaveStatus
  saveErrorMessage: string | null
  lastSavedAt: number | null
  changeToken: number
}

type InventoryEditorModel = InventoryEditorState & {
  etag: string | null
  activeTabKey: InventoryEditorTabKey
  tabStates: ReadonlyArray<InventoryEditorTabState>
  categoryOptions: ReadonlyArray<InventoryCategoryOption>
  referencesStatus: 'loading' | 'ready' | 'error'
  referencesErrorMessage: string | null
  retryReferences: () => void
  concurrencyProblem: ConcurrencyProblem | null
  settingsAutosave: InventorySettingsAutosaveState
  tagsAutosave: InventoryTagsAutosaveState
  customIdTemplate: InventoryCustomIdTemplateBuilderModel
  customFieldDrafts: ReadonlyArray<InventoryEditorCustomFieldDraft>
  selectedCustomFieldKey: string | null
  customFieldValidationByKey: Readonly<Record<string, InventoryEditorCustomFieldDraftErrors>>
  customFieldGlobalValidationErrors: ReadonlyArray<string>
  customFieldsSaveStatus: CustomFieldsAutosaveStatus
  customFieldsSaveErrorMessage: string | null
  customFieldsLastSavedAt: number | null
  isCustomFieldsMutating: boolean
  deleteFlow: InventoryDeleteState
  updateSettingsDraft: (patch: Partial<InventoryEditorSettingsDraft>) => void
  uploadSettingsImage: (file: File) => Promise<boolean>
  deleteSettingsImageFromStorage: () => Promise<boolean>
  cancelSettingsImageUpload: () => void
  deleteInventory: () => Promise<boolean>
  saveSettingsNow: () => void
  resetSettingsDraft: () => void
  updateTagsDraft: (nextTags: ReadonlyArray<string>) => void
  saveTagsNow: () => void
  resetTagsDraft: () => void
  setSelectedCustomFieldKey: (fieldKey: string | null) => void
  addCustomFieldDraft: () => void
  updateCustomFieldDraft: (
    fieldKey: string,
    patch: Partial<Pick<InventoryEditorCustomFieldDraft, 'fieldType' | 'title' | 'description' | 'showInTable'>>,
  ) => void
  removeSelectedCustomFieldDraft: () => void
  moveSelectedCustomFieldDraftUp: () => void
  moveSelectedCustomFieldDraftDown: () => void
  resetCustomFieldDrafts: () => void
  setActiveTabKey: (nextTabKey: InventoryEditorTabKey) => void
  clearConcurrencyProblem: () => void
  retryLoad: () => void
}

const initialState: InventoryEditorState = {
  status: 'idle',
  editor: null,
  errorMessage: null,
  errorStatus: null,
}
const settingsAutosaveIntervalMs = 8_000
const tagsAutosaveIntervalMs = 8_000
const maxImageUploadFileNameLength = 255
const maxImageUploadContentTypeLength = 255
const allowedUploadFileExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.pdf'])
const allowedUploadMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'application/pdf',
])
const customFieldTypeOrder: ReadonlyArray<InventoryCustomFieldType> = [
  'single_line',
  'multi_line',
  'number',
  'link',
  'bool',
]
const defaultCustomFieldErrors: InventoryEditorCustomFieldDraftErrors = {
  title: null,
  description: null,
}
const emptyCustomFieldsValidation: CustomFieldsValidationState = {
  byFieldKey: {},
  globalErrors: [],
  hasErrors: false,
  firstErrorMessage: null,
}
const initialCustomFieldsState: CustomFieldsEditorState = {
  draftFields: [],
  persistedFields: [],
  selectedFieldKey: null,
  validation: emptyCustomFieldsValidation,
  isDirty: false,
  saveStatus: 'idle',
  saveErrorMessage: null,
  lastSavedAt: null,
  changeToken: 0,
}
const maxCustomIdFixedTextLength = 500
const maxCustomIdFormatPatternLength = 200

function createInitialSettingsImageUploadState(): InventorySettingsImageUploadState {
  return {
    status: 'idle',
    fileName: null,
    progressPercent: null,
    errorMessage: null,
    uploadedPublicUrl: null,
    expiresAtUtc: null,
  }
}

type CustomIdTemplateEditorState = {
  draftIsEnabled: boolean
  draftParts: ReadonlyArray<CustomIdTemplateDraftPart>
  persistedIsEnabled: boolean
  persistedParts: ReadonlyArray<CustomIdTemplateDraftPart>
  selectedPartId: string | null
  derivedValidationRegex: string | null
  previewSampleCustomId: string
  previewWarnings: ReadonlyArray<string>
  validationErrors: Record<string, string[]>
  previewErrorMessage: string | null
  saveErrorMessage: string | null
  isPreviewing: boolean
  isSaving: boolean
}

function normalizeOptional(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeTags(tags: ReadonlyArray<string>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const rawTag of tags) {
    const tag = rawTag.trim()
    if (tag.length === 0) {
      continue
    }

    const key = tag.toLocaleLowerCase()
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    out.push(tag)
  }

  return out
}

function tagErrors(tags: ReadonlyArray<string>): Record<string, string[]> {
  for (const tag of tags) {
    if (tag.length > inventoryEditorTagsContract.maxTagLength) {
      return {
        tags: [`Each tag must be ${String(inventoryEditorTagsContract.maxTagLength)} characters or less.`],
      }
    }
  }

  return {}
}

function settingsErrors(draft: InventoryEditorSettingsDraft): InventoryEditorSettingsFieldErrors {
  const errors: InventoryEditorSettingsFieldErrors = {}
  const title = draft.title.trim()
  if (title.length === 0) {
    errors.title = ['Title is required.']
  } else if (title.length > 200) {
    errors.title = ['Title must be 200 characters or less.']
  }

  if (draft.descriptionMarkdown.length > 10_000) {
    errors.descriptionMarkdown = ['Description must be 10000 characters or less.']
  }

  if (draft.categoryId === null || draft.categoryId <= 0) {
    errors.categoryId = ['Category is required.']
  }

  const imageUrl = normalizeOptional(draft.imageUrl)
  if (imageUrl !== null) {
    if (imageUrl.length > 2_048) {
      errors.imageUrl = ['Image URL must be 2048 characters or less.']
    } else {
      try {
        new URL(imageUrl)
      } catch {
        errors.imageUrl = ['Image URL must be a valid absolute URL.']
      }
    }
  }

  return errors
}

function hasErrors(errors: Record<string, string[]> | InventoryEditorSettingsFieldErrors): boolean {
  return Object.values(errors).some((messages) => (messages?.length ?? 0) > 0)
}

function firstError(errors: Record<string, string[]> | InventoryEditorSettingsFieldErrors): string | null {
  for (const messages of Object.values(errors)) {
    if ((messages?.length ?? 0) > 0) {
      return messages![0]
    }
  }

  return null
}

function settingsFailureMessage(failure: ApiFailure): string {
  if (failure.status === 403) {
    return 'Only inventory creator or admin can modify settings.'
  }

  if (failure.status === 404) {
    return 'Inventory was not found.'
  }

  return firstError(failure.problem?.errors ?? {}) ?? failure.error.message
}

function validateImageUploadFile(file: File): string | null {
  const normalizedFileName = file.name.trim()
  const normalizedContentType = file.type.trim().toLowerCase()
  const extensionMatch = /\.[^./\\]+$/.exec(normalizedFileName)
  const normalizedExtension = extensionMatch === null
    ? ''
    : extensionMatch[0].toLowerCase()

  if (normalizedFileName.length === 0) {
    return 'File name is required.'
  }

  if (normalizedFileName.length > maxImageUploadFileNameLength) {
    return `File name must be ${String(maxImageUploadFileNameLength)} characters or less.`
  }

  if (!allowedUploadFileExtensions.has(normalizedExtension)) {
    return 'Only .jpg, .jpeg, .png, .webp, .gif, .bmp and .pdf files are allowed.'
  }

  if (normalizedContentType.length === 0) {
    return 'File content type is required.'
  }

  if (normalizedContentType.length > maxImageUploadContentTypeLength) {
    return `File content type must be ${String(maxImageUploadContentTypeLength)} characters or less.`
  }

  if (!allowedUploadMimeTypes.has(normalizedContentType)) {
    return 'Only image files (jpg/jpeg/png/webp/gif/bmp) and PDF are allowed.'
  }

  if (normalizedExtension === '.pdf' && normalizedContentType !== 'application/pdf') {
    return 'PDF files must have content type application/pdf.'
  }

  if (normalizedExtension !== '.pdf' && !normalizedContentType.startsWith('image/')) {
    return 'Image files must have image/* content type.'
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return 'File size must be positive.'
  }

  return null
}

function imageUploadPresignFailureMessage(failure: ApiFailure): string {
  if (failure.status === 401) {
    return 'Sign in to upload files.'
  }

  if (failure.status === 403) {
    return 'You do not have permission to upload files.'
  }

  return firstError(failure.problem?.errors ?? {}) ?? failure.error.message
}

function tagsFailureMessage(failure: ApiFailure): string {
  if (failure.status === 403) {
    return 'Only inventory creator or admin can modify tags.'
  }

  if (failure.status === 404) {
    return 'Inventory was not found.'
  }

  return firstError(failure.problem?.errors ?? {}) ?? failure.error.message
}

function customFieldsFailureMessage(failure: ApiFailure): string {
  if (failure.status === 403) {
    return 'Only inventory creator or admin can modify custom fields.'
  }

  if (failure.status === 404) {
    return 'Inventory was not found.'
  }

  return firstError(failure.problem?.errors ?? {}) ?? failure.error.message
}

function deleteInventoryFailureMessage(failure: ApiFailure): string {
  if (failure.status === 403) {
    return 'Only inventory creator or admin can delete this inventory.'
  }

  if (failure.status === 404) {
    return 'Inventory was not found or is already deleted.'
  }

  return firstError(failure.problem?.errors ?? {}) ?? failure.error.message
}

function requestFailureMessage(failure: Extract<InventoryEditorRequestResult, { ok: false }>): string {
  if (failure.status === 401) {
    return 'Sign in to open the inventory editor.'
  }

  if (failure.status === 403) {
    return 'Only the inventory creator or admin can open editor tabs.'
  }

  if (failure.status === 404) {
    return 'Inventory editor data was not found.'
  }

  return failure.message
}

function tabStates(editor: InventoryEditor | null): ReadonlyArray<InventoryEditorTabState> {
  if (editor === null) {
    return []
  }

  return [
    { key: 'settings', label: 'Settings', disabled: !editor.permissions.canEditInventory },
    { key: 'tags', label: 'Tags', disabled: !editor.permissions.canEditInventory },
    { key: 'access', label: 'Access', disabled: !editor.permissions.canManageAccess },
    { key: 'customFields', label: 'Custom Fields', disabled: !editor.permissions.canManageCustomFields },
    { key: 'customIdTemplate', label: 'Custom ID', disabled: !editor.permissions.canManageCustomIdTemplate },
  ]
}

function resolveActive(
  requested: InventoryEditorTabKey,
  tabs: ReadonlyArray<InventoryEditorTabState>,
): InventoryEditorTabKey {
  if (tabs.length === 0) {
    return requested
  }

  const selected = tabs.find((tab) => tab.key === requested)
  if (selected !== undefined && !selected.disabled) {
    return selected.key
  }

  return tabs.find((tab) => !tab.disabled)?.key ?? requested
}

function toCustomFieldDrafts(
  fields: ReadonlyArray<InventoryEditorCustomField>,
): ReadonlyArray<InventoryEditorCustomFieldDraft> {
  return fields.map((field) => ({
    key: `field:${field.id}`,
    id: field.id,
    fieldType: field.fieldType,
    title: field.title,
    description: field.description,
    showInTable: field.showInTable,
  }))
}

function toCustomFieldDraftsFromResponse(
  fields: ReadonlyArray<InventoryEditorCustomField>,
  fallbackDrafts: ReadonlyArray<InventoryEditorCustomFieldDraft>,
): ReadonlyArray<InventoryEditorCustomFieldDraft> {
  return fields.map((field, index) => ({
    key: fallbackDrafts[index]?.key ?? `field:${field.id}`,
    id: field.id,
    fieldType: field.fieldType,
    title: field.title,
    description: field.description,
    showInTable: field.showInTable,
  }))
}

function applySavedIdsToCurrentDrafts(
  currentDrafts: ReadonlyArray<InventoryEditorCustomFieldDraft>,
  submittedDrafts: ReadonlyArray<InventoryEditorCustomFieldDraft>,
  persistedDrafts: ReadonlyArray<InventoryEditorCustomFieldDraft>,
): ReadonlyArray<InventoryEditorCustomFieldDraft> {
  const idByKey = new Map<string, string>()
  const limit = Math.min(submittedDrafts.length, persistedDrafts.length)

  for (let index = 0; index < limit; index += 1) {
    idByKey.set(submittedDrafts[index].key, persistedDrafts[index].id!)
  }

  return currentDrafts.map((field) => {
    const persistedId = idByKey.get(field.key)
    if (persistedId === undefined || field.id === persistedId) {
      return field
    }

    return {
      ...field,
      id: persistedId,
    }
  })
}

function areCustomFieldDraftsEqual(
  left: ReadonlyArray<InventoryEditorCustomFieldDraft>,
  right: ReadonlyArray<InventoryEditorCustomFieldDraft>,
): boolean {
  if (left.length !== right.length) {
    return false
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftField = left[index]
    const rightField = right[index]
    if (
      leftField.id !== rightField.id
      || leftField.fieldType !== rightField.fieldType
      || leftField.title !== rightField.title
      || leftField.description !== rightField.description
      || leftField.showInTable !== rightField.showInTable
    ) {
      return false
    }
  }

  return true
}

function resolveSelectedCustomFieldKey(
  requestedKey: string | null,
  fields: ReadonlyArray<InventoryEditorCustomFieldDraft>,
): string | null {
  if (fields.length === 0) {
    return null
  }

  if (requestedKey !== null && fields.some((field) => field.key === requestedKey)) {
    return requestedKey
  }

  return fields[0].key
}

function validateCustomFieldDrafts(fields: ReadonlyArray<InventoryEditorCustomFieldDraft>): CustomFieldsValidationState {
  const byFieldKey: Record<string, InventoryEditorCustomFieldDraftErrors> = {}
  const globalErrors: string[] = []
  const counters: Record<InventoryCustomFieldType, number> = {
    single_line: 0,
    multi_line: 0,
    number: 0,
    link: 0,
    bool: 0,
  }

  for (const field of fields) {
    counters[field.fieldType] += 1
    let titleError: string | null = null
    let descriptionError: string | null = null

    const normalizedTitle = field.title.trim()
    if (normalizedTitle.length === 0) {
      titleError = 'Title is required.'
    } else if (normalizedTitle.length > inventoryCustomFieldsAutosaveContract.maxTitleLength) {
      titleError = `Title must be ${String(inventoryCustomFieldsAutosaveContract.maxTitleLength)} characters or less.`
    }

    if (field.description.length > inventoryCustomFieldsAutosaveContract.maxDescriptionLength) {
      descriptionError = (
        `Description must be ${String(inventoryCustomFieldsAutosaveContract.maxDescriptionLength)} characters or less.`
      )
    }

    byFieldKey[field.key] = titleError === null && descriptionError === null
      ? defaultCustomFieldErrors
      : {
        title: titleError,
        description: descriptionError,
      }
  }

  for (const fieldType of customFieldTypeOrder) {
    if (counters[fieldType] > inventoryCustomFieldsAutosaveContract.maxFieldsPerType) {
      globalErrors.push(
        `No more than ${String(inventoryCustomFieldsAutosaveContract.maxFieldsPerType)} "${fieldType}" fields are allowed.`,
      )
    }
  }

  const firstFieldError = Object.values(byFieldKey).find(
    (errors) => errors.title !== null || errors.description !== null,
  )
  const firstErrorMessage = globalErrors[0] ?? firstFieldError?.title ?? firstFieldError?.description ?? null

  return {
    byFieldKey,
    globalErrors,
    hasErrors: firstErrorMessage !== null,
    firstErrorMessage,
  }
}

function toCustomFieldsPayload(
  fields: ReadonlyArray<InventoryEditorCustomFieldDraft>,
): ReplaceInventoryCustomFieldsRequestPayload {
  return {
    fields: fields.map((field) => ({
      id: field.id,
      fieldType: field.fieldType,
      title: field.title.trim(),
      description: field.description.trim(),
      showInTable: field.showInTable,
    })),
  }
}

function findPreferredFieldType(fields: ReadonlyArray<InventoryEditorCustomFieldDraft>): InventoryCustomFieldType {
  const counters: Record<InventoryCustomFieldType, number> = {
    single_line: 0,
    multi_line: 0,
    number: 0,
    link: 0,
    bool: 0,
  }

  for (const field of fields) {
    counters[field.fieldType] += 1
  }

  for (const fieldType of customFieldTypeOrder) {
    if (counters[fieldType] < inventoryCustomFieldsAutosaveContract.maxFieldsPerType) {
      return fieldType
    }
  }

  return 'single_line'
}

function buildCustomFieldsStateFromDraft(
  current: CustomFieldsEditorState,
  nextDraftFields: ReadonlyArray<InventoryEditorCustomFieldDraft>,
  requestedSelection: string | null = current.selectedFieldKey,
): CustomFieldsEditorState {
  const validation = validateCustomFieldDrafts(nextDraftFields)
  const isDirty = !areCustomFieldDraftsEqual(nextDraftFields, current.persistedFields)

  if (!isDirty) {
    return {
      ...current,
      draftFields: nextDraftFields,
      selectedFieldKey: resolveSelectedCustomFieldKey(requestedSelection, nextDraftFields),
      validation,
      isDirty: false,
      saveStatus: 'idle',
      saveErrorMessage: null,
      changeToken: current.changeToken + 1,
    }
  }

  if (validation.hasErrors) {
    return {
      ...current,
      draftFields: nextDraftFields,
      selectedFieldKey: resolveSelectedCustomFieldKey(requestedSelection, nextDraftFields),
      validation,
      isDirty: true,
      saveStatus: 'error',
      saveErrorMessage: validation.firstErrorMessage,
      changeToken: current.changeToken + 1,
    }
  }

  return {
    ...current,
    draftFields: nextDraftFields,
    selectedFieldKey: resolveSelectedCustomFieldKey(requestedSelection, nextDraftFields),
    validation,
    isDirty: true,
    saveStatus: 'pending',
    saveErrorMessage: null,
    changeToken: current.changeToken + 1,
  }
}

function createCustomFieldsStateFromEditor(editor: InventoryEditor): CustomFieldsEditorState {
  const draftFields = toCustomFieldDrafts(editor.customFields)
  return {
    draftFields,
    persistedFields: draftFields,
    selectedFieldKey: resolveSelectedCustomFieldKey(null, draftFields),
    validation: validateCustomFieldDrafts(draftFields),
    isDirty: false,
    saveStatus: 'idle',
    saveErrorMessage: null,
    lastSavedAt: null,
    changeToken: 0,
  }
}

function moveCustomField(
  fields: ReadonlyArray<InventoryEditorCustomFieldDraft>,
  fromIndex: number,
  toIndex: number,
): ReadonlyArray<InventoryEditorCustomFieldDraft> {
  if (
    fromIndex < 0
    || fromIndex >= fields.length
    || toIndex < 0
    || toIndex >= fields.length
    || fromIndex === toIndex
  ) {
    return fields
  }

  const reordered = [...fields]
  const [moved] = reordered.splice(fromIndex, 1)
  reordered.splice(toIndex, 0, moved)
  return reordered
}

function supportsCustomIdFormatPattern(partType: InventoryCustomIdPartType): boolean {
  return partType === 'datetime' || partType === 'sequence'
}

function toCustomIdDraftPart(
  clientId: string,
  partType: InventoryCustomIdPartType,
  fixedText: string | null,
  formatPattern: string | null,
): CustomIdTemplateDraftPart {
  return {
    clientId,
    partType,
    fixedText: fixedText ?? '',
    formatPattern: formatPattern ?? '',
  }
}

function toCustomIdDraftPartsFromEditor(
  editor: InventoryEditor,
): ReadonlyArray<CustomIdTemplateDraftPart> {
  return editor.customIdTemplate.parts.map((part) => (
    toCustomIdDraftPart(
      `part:${part.id}`,
      part.partType,
      part.fixedText,
      part.formatPattern,
    )
  ))
}

function resolveSelectedCustomIdPartId(
  requestedPartId: string | null,
  parts: ReadonlyArray<CustomIdTemplateDraftPart>,
): string | null {
  if (parts.length === 0) {
    return null
  }

  if (requestedPartId !== null && parts.some((part) => part.clientId === requestedPartId)) {
    return requestedPartId
  }

  return parts[0].clientId
}

function areCustomIdTemplateDraftPartsEqual(
  left: ReadonlyArray<CustomIdTemplateDraftPart>,
  right: ReadonlyArray<CustomIdTemplateDraftPart>,
): boolean {
  if (left.length !== right.length) {
    return false
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftPart = left[index]
    const rightPart = right[index]
    if (
      leftPart.partType !== rightPart.partType
      || leftPart.fixedText !== rightPart.fixedText
      || leftPart.formatPattern !== rightPart.formatPattern
    ) {
      return false
    }
  }

  return true
}

const initialCustomIdTemplateState: CustomIdTemplateEditorState = {
  draftIsEnabled: false,
  draftParts: [],
  persistedIsEnabled: false,
  persistedParts: [],
  selectedPartId: null,
  derivedValidationRegex: null,
  previewSampleCustomId: '',
  previewWarnings: [],
  validationErrors: {},
  previewErrorMessage: null,
  saveErrorMessage: null,
  isPreviewing: false,
  isSaving: false,
}

function createCustomIdTemplateStateFromEditor(editor: InventoryEditor): CustomIdTemplateEditorState {
  const draftParts = toCustomIdDraftPartsFromEditor(editor)
  return {
    draftIsEnabled: editor.customIdTemplate.isEnabled,
    draftParts,
    persistedIsEnabled: editor.customIdTemplate.isEnabled,
    persistedParts: draftParts,
    selectedPartId: resolveSelectedCustomIdPartId(null, draftParts),
    derivedValidationRegex: editor.customIdTemplate.derivedValidationRegex,
    previewSampleCustomId: editor.customIdTemplate.preview.sampleCustomId,
    previewWarnings: [...editor.customIdTemplate.preview.warnings],
    validationErrors: {},
    previewErrorMessage: null,
    saveErrorMessage: null,
    isPreviewing: false,
    isSaving: false,
  }
}

function toCustomIdTemplateMutationPayload(
  isEnabled: boolean,
  parts: ReadonlyArray<CustomIdTemplateDraftPart>,
): InventoryCustomIdTemplateMutationPayload {
  return {
    isEnabled,
    parts: parts.map((part) => {
      if (part.partType === 'fixed_text') {
        return {
          partType: part.partType,
          fixedText: normalizeOptional(part.fixedText),
          formatPattern: null,
        }
      }

      if (supportsCustomIdFormatPattern(part.partType)) {
        return {
          partType: part.partType,
          fixedText: null,
          formatPattern: normalizeOptional(part.formatPattern),
        }
      }

      return {
        partType: part.partType,
        fixedText: null,
        formatPattern: null,
      }
    }),
  }
}

function validateCustomIdTemplatePayload(
  payload: InventoryCustomIdTemplateMutationPayload,
): Record<string, string[]> {
  const errors: Record<string, string[]> = {}
  let sequencePartCount = 0

  payload.parts.forEach((part, index) => {
    const basePath = `parts[${String(index)}]`

    if (part.partType === 'fixed_text') {
      const fixedText = part.fixedText?.trim() ?? ''
      if (fixedText.length === 0) {
        errors[`${basePath}.fixedText`] = ['fixedText is required for fixed_text part.']
      } else if (fixedText.length > maxCustomIdFixedTextLength) {
        errors[`${basePath}.fixedText`] = [`fixedText must be ${String(maxCustomIdFixedTextLength)} characters or less.`]
      }
    } else if ((part.fixedText?.trim().length ?? 0) > 0) {
      errors[`${basePath}.fixedText`] = ['fixedText is allowed only for fixed_text part.']
    }

    if (part.partType === 'sequence') {
      sequencePartCount += 1
    }

    if (supportsCustomIdFormatPattern(part.partType)) {
      if ((part.formatPattern?.length ?? 0) > maxCustomIdFormatPatternLength) {
        errors[`${basePath}.formatPattern`] = [
          `formatPattern must be ${String(maxCustomIdFormatPatternLength)} characters or less.`,
        ]
      }
    } else if ((part.formatPattern?.trim().length ?? 0) > 0) {
      errors[`${basePath}.formatPattern`] = ['formatPattern is allowed only for datetime and sequence parts.']
    }
  })

  if (sequencePartCount > 1) {
    errors.parts = ['Only one sequence part is allowed.']
  }

  return errors
}

function toCustomIdDraftPartsFromMutationResponse(
  response: InventoryCustomIdTemplateMutationResponse,
  fallbackParts: ReadonlyArray<CustomIdTemplateDraftPart>,
  nextClientId: () => string,
): ReadonlyArray<CustomIdTemplateDraftPart> {
  return response.parts.map((part, index) => (
    toCustomIdDraftPart(
      fallbackParts[index]?.clientId ?? nextClientId(),
      part.partType,
      part.fixedText,
      part.formatPattern,
    )
  ))
}

function customIdPreviewFailureMessage(failure: ApiFailure): string {
  if (failure.status === 403) {
    return 'Only inventory creator or admin can preview custom ID template.'
  }

  if (failure.status === 404) {
    return 'Inventory was not found.'
  }

  return firstError(failure.problem?.errors ?? {}) ?? failure.error.message
}

function customIdSaveFailureMessage(failure: ApiFailure): string {
  if (failure.status === 403) {
    return 'Only inventory creator or admin can save custom ID template.'
  }

  if (failure.status === 404) {
    return 'Inventory was not found.'
  }

  return firstError(failure.problem?.errors ?? {}) ?? failure.error.message
}

export function useInventoryEditorModel(inventoryId: string | null): InventoryEditorModel {
  const references = useSystemReferences()
  const [state, setState] = useState(initialState)
  const [activeTabKey, setActiveTabKey] = useState<InventoryEditorTabKey>('settings')
  const [reloadToken, setReloadToken] = useState(0)

  const [persistedSettingsDraft, setPersistedSettingsDraft] = useState<InventoryEditorSettingsDraft | null>(null)
  const [settingsDraft, setSettingsDraft] = useState<InventoryEditorSettingsDraft | null>(null)
  const [settingsFieldErrors, setSettingsFieldErrors] = useState<InventoryEditorSettingsFieldErrors>({})
  const [settingsErrorMessage, setSettingsErrorMessage] = useState<string | null>(null)
  const [settingsLastSavedAt, setSettingsLastSavedAt] = useState<string | null>(null)
  const [isSettingsSaving, setIsSettingsSaving] = useState(false)
  const [isSettingsQueued, setIsSettingsQueued] = useState(false)
  const [settingsImageUpload, setSettingsImageUpload] = useState<InventorySettingsImageUploadState>(
    createInitialSettingsImageUploadState(),
  )

  const [persistedTags, setPersistedTags] = useState<ReadonlyArray<string>>([])
  const [tagsDraft, setTagsDraft] = useState<ReadonlyArray<string>>([])
  const [tagsFieldErrors, setTagsFieldErrors] = useState<Record<string, string[]>>({})
  const [tagsErrorMessage, setTagsErrorMessage] = useState<string | null>(null)
  const [tagsLastSavedAt, setTagsLastSavedAt] = useState<string | null>(null)
  const [isTagsSaving, setIsTagsSaving] = useState(false)
  const [isTagsQueued, setIsTagsQueued] = useState(false)

  const [customFieldsState, setCustomFieldsState] = useState<CustomFieldsEditorState>(initialCustomFieldsState)
  const [isCustomFieldsSaving, setIsCustomFieldsSaving] = useState(false)
  const [isCustomFieldsQueued, setIsCustomFieldsQueued] = useState(false)
  const [isDeletingInventory, setIsDeletingInventory] = useState(false)
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null)
  const [customIdTemplateState, setCustomIdTemplateState] = useState<CustomIdTemplateEditorState>(
    initialCustomIdTemplateState,
  )

  const requestRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const settingsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tagsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const customFieldsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const customFieldDraftKeyRef = useRef(0)
  const customIdPartKeyRef = useRef(0)
  const customIdPreviewRequestRef = useRef(0)
  const customIdPreviewAbortRef = useRef<AbortController | null>(null)
  const settingsImageUploadRequestRef = useRef(0)
  const settingsImageUploadAbortRef = useRef<AbortController | null>(null)

  const {
    versionStamp,
    setVersionStamp,
    resetVersionStamp,
    concurrencyProblem,
    clearConcurrencyProblem,
    executeVersionedMutation,
  } = useVersionedMutationModel()

  const retryLoad = useCallback(() => setReloadToken((value) => value + 1), [])

  useEffect(
    () => () => {
      abortRef.current?.abort()
      if (settingsTimerRef.current !== null) {
        clearTimeout(settingsTimerRef.current)
      }

      if (tagsTimerRef.current !== null) {
        clearTimeout(tagsTimerRef.current)
      }

      if (customFieldsTimerRef.current !== null) {
        clearTimeout(customFieldsTimerRef.current)
      }
      customIdPreviewAbortRef.current?.abort()
      settingsImageUploadAbortRef.current?.abort()
    },
    [],
  )

  useEffect(() => {
    abortRef.current?.abort()
    if (settingsTimerRef.current !== null) {
      clearTimeout(settingsTimerRef.current)
    }
    if (tagsTimerRef.current !== null) {
      clearTimeout(tagsTimerRef.current)
    }
    if (customFieldsTimerRef.current !== null) {
      clearTimeout(customFieldsTimerRef.current)
    }
    customIdPreviewAbortRef.current?.abort()
    settingsImageUploadAbortRef.current?.abort()

    if (inventoryId === null) {
      clearConcurrencyProblem()
      resetVersionStamp()

      setState({
        status: 'error',
        editor: null,
        errorMessage: 'Inventory editor URL must contain a positive numeric id.',
        errorStatus: null,
      })

      setPersistedSettingsDraft(null)
      setSettingsDraft(null)
      setSettingsFieldErrors({})
      setSettingsErrorMessage(null)
      setSettingsLastSavedAt(null)
      setIsSettingsSaving(false)
      setIsSettingsQueued(false)
      setSettingsImageUpload(createInitialSettingsImageUploadState())

      setPersistedTags([])
      setTagsDraft([])
      setTagsFieldErrors({})
      setTagsErrorMessage(null)
      setTagsLastSavedAt(null)
      setIsTagsSaving(false)
      setIsTagsQueued(false)

      setCustomFieldsState(initialCustomFieldsState)
      setIsCustomFieldsSaving(false)
      setIsCustomFieldsQueued(false)
      setIsDeletingInventory(false)
      setDeleteErrorMessage(null)
      setCustomIdTemplateState(initialCustomIdTemplateState)
      return
    }

    requestRef.current += 1
    const reqId = requestRef.current
    const abortController = new AbortController()
    abortRef.current = abortController

    void (async () => {
      clearConcurrencyProblem()
      setState((current) => ({
        ...current,
        status: 'loading',
        errorMessage: null,
        errorStatus: null,
      }))

      const response = await requestInventoryEditor(inventoryId, abortController.signal)
      if (abortController.signal.aborted || reqId !== requestRef.current) {
        return
      }

      if (!response.ok) {
        resetVersionStamp()
        setIsDeletingInventory(false)
        setDeleteErrorMessage(null)
        setState({
          status: 'error',
          editor: null,
          errorMessage: requestFailureMessage(response),
          errorStatus: response.status,
        })
        return
      }

      const nextSettings: InventoryEditorSettingsDraft = {
        title: response.data.settings.title,
        descriptionMarkdown: response.data.settings.descriptionMarkdown,
        categoryId: response.data.settings.category.id,
        imageUrl: response.data.settings.imageUrl ?? '',
      }
      const nextTags = normalizeTags(response.data.tags.map((tag) => tag.name))
      const nextCustomFields = createCustomFieldsStateFromEditor(response.data)
      const nextCustomIdTemplate = createCustomIdTemplateStateFromEditor(response.data)

      setPersistedSettingsDraft(nextSettings)
      setSettingsDraft({ ...nextSettings })
      setSettingsFieldErrors({})
      setSettingsErrorMessage(null)
      setSettingsLastSavedAt(null)
      setIsSettingsSaving(false)
      setIsSettingsQueued(false)
      setSettingsImageUpload(createInitialSettingsImageUploadState())

      setPersistedTags(nextTags)
      setTagsDraft([...nextTags])
      setTagsFieldErrors({})
      setTagsErrorMessage(null)
      setTagsLastSavedAt(null)
      setIsTagsSaving(false)
      setIsTagsQueued(false)

      setCustomFieldsState(nextCustomFields)
      setIsCustomFieldsSaving(false)
      setIsCustomFieldsQueued(false)
      setIsDeletingInventory(false)
      setDeleteErrorMessage(null)
      setCustomIdTemplateState(nextCustomIdTemplate)

      setVersionStamp(response.versionStamp)
      setState({
        status: 'ready',
        editor: response.data,
        errorMessage: null,
        errorStatus: null,
      })
    })()

    return () => abortController.abort()
  }, [clearConcurrencyProblem, inventoryId, reloadToken, resetVersionStamp, setVersionStamp])

  const settingsDirtyFields = useMemo(() => {
    if (settingsDraft === null || state.editor === null) {
      return [] as InventoryEditorSettingsField[]
    }

    const dirtyFields: InventoryEditorSettingsField[] = []
    const imageUrl = normalizeOptional(settingsDraft.imageUrl)
    if (settingsDraft.title.trim() !== state.editor.settings.title) {
      dirtyFields.push('title')
    }
    if (settingsDraft.descriptionMarkdown !== state.editor.settings.descriptionMarkdown) {
      dirtyFields.push('descriptionMarkdown')
    }
    if ((settingsDraft.categoryId ?? 0) !== state.editor.settings.category.id) {
      dirtyFields.push('categoryId')
    }
    if (imageUrl !== state.editor.settings.imageUrl) {
      dirtyFields.push('imageUrl')
    }

    return dirtyFields
  }, [settingsDraft, state.editor])

  const isSettingsDirty = settingsDirtyFields.length > 0
  const isTagsDirty = useMemo(
    () => tagsDraft.length !== persistedTags.length || tagsDraft.some((tag, index) => tag !== persistedTags[index]),
    [persistedTags, tagsDraft],
  )

  const canAutosaveSettings = state.editor !== null && state.editor.permissions.canEditInventory && settingsDraft !== null
  const canAutosaveTags = state.editor !== null && state.editor.permissions.canEditInventory
  const canAutosaveCustomFields = state.editor !== null && state.editor.permissions.canManageCustomFields
  const canManageCustomIdTemplate = state.editor !== null && state.editor.permissions.canManageCustomIdTemplate
  const isCustomIdTemplateDirty = useMemo(
    () => (
      customIdTemplateState.draftIsEnabled !== customIdTemplateState.persistedIsEnabled
      || !areCustomIdTemplateDraftPartsEqual(customIdTemplateState.draftParts, customIdTemplateState.persistedParts)
    ),
    [
      customIdTemplateState.draftIsEnabled,
      customIdTemplateState.draftParts,
      customIdTemplateState.persistedIsEnabled,
      customIdTemplateState.persistedParts,
    ],
  )

  const applySettingsDraftPatch = useCallback(
    (
      patch: Partial<InventoryEditorSettingsDraft>,
      options: { queueSave: boolean } = { queueSave: false },
    ) => {
      clearConcurrencyProblem()
      setSettingsErrorMessage(null)
      setSettingsFieldErrors((current) => {
        const nextErrors = { ...current }
        for (const fieldName of Object.keys(patch)) {
          delete nextErrors[fieldName as InventoryEditorSettingsField]
        }
        return nextErrors
      })
      setSettingsDraft((current) => (
        current === null
          ? current
          : {
            ...current,
            ...patch,
          }
      ))
      if (isSettingsSaving || options.queueSave) {
        setIsSettingsQueued(true)
      }
    },
    [clearConcurrencyProblem, isSettingsSaving],
  )

  const cancelSettingsImageUpload = useCallback(() => {
    settingsImageUploadAbortRef.current?.abort()
    settingsImageUploadAbortRef.current = null
    setSettingsImageUpload(createInitialSettingsImageUploadState())
  }, [])

  const uploadSettingsImage = useCallback(async (file: File): Promise<boolean> => {
    if (inventoryId === null || state.editor === null || settingsDraft === null || !canAutosaveSettings) {
      setSettingsImageUpload({
        status: 'error',
        fileName: file.name,
        progressPercent: null,
        errorMessage: 'Settings tab is not ready for image upload.',
        uploadedPublicUrl: null,
        expiresAtUtc: null,
      })
      return false
    }

    const validationError = validateImageUploadFile(file)
    if (validationError !== null) {
      setSettingsImageUpload({
        status: 'error',
        fileName: file.name,
        progressPercent: null,
        errorMessage: validationError,
        uploadedPublicUrl: null,
        expiresAtUtc: null,
      })
      return false
    }

    settingsImageUploadAbortRef.current?.abort()
    const abortController = new AbortController()
    settingsImageUploadAbortRef.current = abortController
    settingsImageUploadRequestRef.current += 1
    const requestId = settingsImageUploadRequestRef.current

    setSettingsImageUpload({
      status: 'uploading',
      fileName: file.name,
      progressPercent: 0,
      errorMessage: null,
      uploadedPublicUrl: null,
      expiresAtUtc: null,
    })

    const uploadResult = await uploadInventoryFile(file, { signal: abortController.signal })

    if (abortController.signal.aborted || requestId !== settingsImageUploadRequestRef.current) {
      return false
    }

    if (!uploadResult.ok) {
      setSettingsImageUpload({
        status: 'error',
        fileName: file.name,
        progressPercent: null,
        errorMessage: imageUploadPresignFailureMessage(uploadResult),
        uploadedPublicUrl: null,
        expiresAtUtc: null,
      })
      settingsImageUploadAbortRef.current = null
      return false
    }

    if (abortController.signal.aborted || requestId !== settingsImageUploadRequestRef.current) {
      return false
    }

    settingsImageUploadAbortRef.current = null
    setSettingsImageUpload({
      status: 'success',
      fileName: file.name,
      progressPercent: 100,
      errorMessage: null,
      uploadedPublicUrl: uploadResult.data.publicUrl,
      expiresAtUtc: null,
    })
    setSettingsLastSavedAt(null)
    applySettingsDraftPatch(
      {
        imageUrl: uploadResult.data.publicUrl,
      },
      { queueSave: true },
    )
    return true
  }, [applySettingsDraftPatch, canAutosaveSettings, inventoryId, settingsDraft, state.editor])

  const deleteSettingsImageFromStorage = useCallback(async (): Promise<boolean> => {
    if (inventoryId === null || state.editor === null || settingsDraft === null || !canAutosaveSettings) {
      setSettingsImageUpload({
        status: 'error',
        fileName: null,
        progressPercent: null,
        errorMessage: 'Settings tab is not ready for file deletion.',
        uploadedPublicUrl: null,
        expiresAtUtc: null,
      })
      return false
    }

    const currentImageUrl = normalizeOptional(settingsDraft.imageUrl)
    if (currentImageUrl === null) {
      setSettingsImageUpload({
        status: 'error',
        fileName: null,
        progressPercent: null,
        errorMessage: 'Image URL is empty.',
        uploadedPublicUrl: null,
        expiresAtUtc: null,
      })
      return false
    }

    settingsImageUploadAbortRef.current?.abort()
    settingsImageUploadRequestRef.current += 1

    setSettingsImageUpload({
      status: 'deleting',
      fileName: null,
      progressPercent: null,
      errorMessage: null,
      uploadedPublicUrl: currentImageUrl,
      expiresAtUtc: null,
    })

    const deleteResult = await deleteInventoryFile(currentImageUrl)
    if (!deleteResult.ok) {
      setSettingsImageUpload({
        status: 'error',
        fileName: null,
        progressPercent: null,
        errorMessage: imageUploadPresignFailureMessage(deleteResult),
        uploadedPublicUrl: null,
        expiresAtUtc: null,
      })
      return false
    }

    setSettingsImageUpload({
      status: 'success',
      fileName: null,
      progressPercent: null,
      errorMessage: null,
      uploadedPublicUrl: null,
      expiresAtUtc: null,
    })

    setSettingsLastSavedAt(null)
    applySettingsDraftPatch(
      {
        imageUrl: '',
      },
      { queueSave: true },
    )
    return true
  }, [applySettingsDraftPatch, canAutosaveSettings, inventoryId, settingsDraft, state.editor])

  const deleteInventory = useCallback(async (): Promise<boolean> => {
    if (inventoryId === null || state.editor === null) {
      setDeleteErrorMessage('Inventory editor data is not ready for deletion.')
      return false
    }

    if (isDeletingInventory) {
      return false
    }

    clearConcurrencyProblem()
    setDeleteErrorMessage(null)
    setIsDeletingInventory(true)

    const result = await executeVersionedMutation((options) => requestDeleteInventory(inventoryId, options))
    setIsDeletingInventory(false)

    if (result === null) {
      if (versionStamp !== null) {
        setDeleteErrorMessage('Another save operation is in progress. Retry after it completes.')
      }

      return false
    }

    if (!result.ok) {
      if (getConcurrencyProblem(result) === null) {
        setDeleteErrorMessage(deleteInventoryFailureMessage(result))
      }

      return false
    }

    if (settingsTimerRef.current !== null) {
      clearTimeout(settingsTimerRef.current)
    }

    if (tagsTimerRef.current !== null) {
      clearTimeout(tagsTimerRef.current)
    }

    if (customFieldsTimerRef.current !== null) {
      clearTimeout(customFieldsTimerRef.current)
    }

    setIsSettingsQueued(false)
    setIsTagsQueued(false)
    setIsCustomFieldsQueued(false)
    setDeleteErrorMessage(null)
    return true
  }, [
    clearConcurrencyProblem,
    executeVersionedMutation,
    inventoryId,
    isDeletingInventory,
    state.editor,
    versionStamp,
  ])

  const saveSettings = useCallback(async () => {
    if (inventoryId === null || state.editor === null || settingsDraft === null) {
      return
    }

    if (isSettingsSaving) {
      setIsSettingsQueued(true)
      return
    }

    const clientErrors = settingsErrors(settingsDraft)
    if (hasErrors(clientErrors)) {
      setSettingsFieldErrors(clientErrors)
      setSettingsErrorMessage(firstError(clientErrors))
      return
    }

    const payload = {
      title: settingsDraft.title.trim(),
      descriptionMarkdown: settingsDraft.descriptionMarkdown,
      categoryId: settingsDraft.categoryId as number,
      imageUrl: normalizeOptional(settingsDraft.imageUrl),
    }
    if (!Number.isInteger(payload.categoryId) || payload.categoryId <= 0) {
      const categoryErrors: InventoryEditorSettingsFieldErrors = {
        categoryId: ['Category is required.'],
      }
      setSettingsFieldErrors(categoryErrors)
      setSettingsErrorMessage('Category is required.')
      return
    }

    setIsSettingsSaving(true)
    setIsSettingsQueued(false)
    setSettingsErrorMessage(null)

    const result = await executeVersionedMutation((options) => updateInventorySettings(inventoryId, payload, options))
    setIsSettingsSaving(false)

    if (result === null) {
      setIsSettingsQueued(true)
      return
    }

    if (!result.ok) {
      const serverErrors = result.problem?.errors ?? {}
      setSettingsFieldErrors({
        ...clientErrors,
        ...serverErrors,
      } as InventoryEditorSettingsFieldErrors)
      if (getConcurrencyProblem(result) === null) {
        setSettingsErrorMessage(settingsFailureMessage(result))
      }
      return
    }

    const nextDraft = {
      title: payload.title,
      descriptionMarkdown: payload.descriptionMarkdown,
      categoryId: payload.categoryId,
      imageUrl: payload.imageUrl ?? '',
    }

    setPersistedSettingsDraft(nextDraft)
    setSettingsDraft({ ...nextDraft })
    setSettingsFieldErrors({})
    setSettingsErrorMessage(null)
    setSettingsLastSavedAt(new Date().toISOString())
    setIsSettingsQueued(false)
    setState((current) => (
      current.editor === null
        ? current
        : {
          ...current,
          editor: {
            ...current.editor,
            version: result.data.version,
            settings: {
              ...current.editor.settings,
              title: nextDraft.title,
              descriptionMarkdown: nextDraft.descriptionMarkdown,
              imageUrl: payload.imageUrl,
              category: references.getCategoryById(nextDraft.categoryId) ?? current.editor.settings.category,
            },
          },
        }
    ))
  }, [executeVersionedMutation, inventoryId, isSettingsSaving, references, settingsDraft, state.editor])

  const saveTags = useCallback(async () => {
    if (inventoryId === null || state.editor === null) {
      return
    }

    if (isTagsSaving) {
      setIsTagsQueued(true)
      return
    }

    const normalized = normalizeTags(tagsDraft)
    const clientErrors = tagErrors(normalized)
    if (hasErrors(clientErrors)) {
      setTagsFieldErrors(clientErrors)
      setTagsErrorMessage(firstError(clientErrors))
      return
    }

    setIsTagsSaving(true)
    setIsTagsQueued(false)
    setTagsErrorMessage(null)

    const result = await executeVersionedMutation((options) => replaceInventoryTags(inventoryId, normalized, options))
    setIsTagsSaving(false)

    if (result === null) {
      setIsTagsQueued(true)
      return
    }

    if (!result.ok) {
      setTagsFieldErrors(result.problem?.errors ?? {})
      if (getConcurrencyProblem(result) === null) {
        setTagsErrorMessage(tagsFailureMessage(result))
      }
      return
    }

    setPersistedTags(normalized)
    setTagsDraft([...normalized])
    setTagsFieldErrors({})
    setTagsErrorMessage(null)
    setTagsLastSavedAt(new Date().toISOString())
    setIsTagsQueued(false)
    setState((current) => (
      current.editor === null
        ? current
        : {
          ...current,
          editor: {
            ...current.editor,
            version: result.data.version,
            tags: normalized.map((name, index) => ({
              id: current.editor?.tags[index]?.id ?? `draft-${String(index + 1)}`,
              name,
            })),
          },
        }
    ))
  }, [executeVersionedMutation, inventoryId, isTagsSaving, state.editor, tagsDraft])

  const saveCustomFields = useCallback(async () => {
    if (inventoryId === null || state.editor === null || !canAutosaveCustomFields) {
      return
    }

    if (isCustomFieldsSaving) {
      setIsCustomFieldsQueued(true)
      return
    }

    if (!customFieldsState.isDirty) {
      return
    }

    if (customFieldsState.validation.hasErrors) {
      setCustomFieldsState((current) => ({
        ...current,
        saveStatus: 'error',
        saveErrorMessage: current.validation.firstErrorMessage,
      }))
      return
    }

    const submittedDrafts = customFieldsState.draftFields
    const submittedChangeToken = customFieldsState.changeToken
    const payload = toCustomFieldsPayload(submittedDrafts)

    setIsCustomFieldsSaving(true)
    setIsCustomFieldsQueued(false)
    setCustomFieldsState((current) => ({
      ...current,
      saveStatus: 'saving',
      saveErrorMessage: null,
    }))

    const result = await executeVersionedMutation((options) => (
      replaceInventoryCustomFields(inventoryId, payload, options)
    ))
    setIsCustomFieldsSaving(false)

    if (result === null) {
      if (versionStamp === null) {
        setCustomFieldsState((current) => ({
          ...current,
          saveStatus: 'conflict',
          saveErrorMessage: null,
        }))
        return
      }

      setIsCustomFieldsQueued(true)
      return
    }

    if (!result.ok) {
      const concurrencyIssue = getConcurrencyProblem(result)
      if (concurrencyIssue !== null) {
        setCustomFieldsState((current) => ({
          ...current,
          saveStatus: 'conflict',
          saveErrorMessage: null,
        }))
      } else {
        setCustomFieldsState((current) => ({
          ...current,
          saveStatus: 'error',
          saveErrorMessage: customFieldsFailureMessage(result),
        }))
      }
      return
    }

    const persistedFields = toCustomFieldDraftsFromResponse(result.data.fields, submittedDrafts)
    const savedAt = Date.now()

    setCustomFieldsState((current) => {
      const hasLocalChangesAfterSubmit = current.changeToken !== submittedChangeToken
      const nextDraftFields = hasLocalChangesAfterSubmit
        ? applySavedIdsToCurrentDrafts(current.draftFields, submittedDrafts, persistedFields)
        : persistedFields
      const validation = validateCustomFieldDrafts(nextDraftFields)
      const isDirty = !areCustomFieldDraftsEqual(nextDraftFields, persistedFields)

      return {
        ...current,
        draftFields: nextDraftFields,
        persistedFields,
        selectedFieldKey: resolveSelectedCustomFieldKey(current.selectedFieldKey, nextDraftFields),
        validation,
        isDirty,
        saveStatus: !isDirty ? 'saved' : validation.hasErrors ? 'error' : 'pending',
        saveErrorMessage: !isDirty ? null : validation.firstErrorMessage,
        lastSavedAt: savedAt,
        changeToken: hasLocalChangesAfterSubmit ? current.changeToken + 1 : current.changeToken,
      }
    })

    setState((current) => (
      current.editor === null
        ? current
        : {
          ...current,
          editor: {
            ...current.editor,
            version: result.data.version,
            customFields: result.data.fields,
          },
        }
    ))
  }, [
    canAutosaveCustomFields,
    customFieldsState.changeToken,
    customFieldsState.draftFields,
    customFieldsState.isDirty,
    customFieldsState.validation.hasErrors,
    executeVersionedMutation,
    inventoryId,
    isCustomFieldsSaving,
    state.editor,
    versionStamp,
  ])

  const nextCustomIdPartClientId = useCallback(() => {
    customIdPartKeyRef.current += 1
    return `new:${String(customIdPartKeyRef.current)}`
  }, [])

  const setCustomIdEnabled = useCallback((nextValue: boolean) => {
    customIdPreviewAbortRef.current?.abort()
    clearConcurrencyProblem()
    setCustomIdTemplateState((current) => ({
      ...current,
      draftIsEnabled: nextValue,
      validationErrors: {},
      previewErrorMessage: null,
      saveErrorMessage: null,
      isPreviewing: false,
    }))
  }, [clearConcurrencyProblem])

  const selectCustomIdPart = useCallback((partId: string | null) => {
    setCustomIdTemplateState((current) => ({
      ...current,
      selectedPartId: resolveSelectedCustomIdPartId(partId, current.draftParts),
    }))
  }, [])

  const addCustomIdPart = useCallback((partType: InventoryCustomIdPartType) => {
    customIdPreviewAbortRef.current?.abort()
    clearConcurrencyProblem()
    setCustomIdTemplateState((current) => {
      const nextPart: CustomIdTemplateDraftPart = {
        clientId: nextCustomIdPartClientId(),
        partType,
        fixedText: '',
        formatPattern: '',
      }
      const nextDraftParts = [...current.draftParts, nextPart]
      return {
        ...current,
        draftParts: nextDraftParts,
        selectedPartId: resolveSelectedCustomIdPartId(nextPart.clientId, nextDraftParts),
        validationErrors: {},
        previewErrorMessage: null,
        saveErrorMessage: null,
        isPreviewing: false,
      }
    })
  }, [clearConcurrencyProblem, nextCustomIdPartClientId])

  const updateCustomIdPartType = useCallback((partId: string, nextType: InventoryCustomIdPartType) => {
    customIdPreviewAbortRef.current?.abort()
    clearConcurrencyProblem()
    setCustomIdTemplateState((current) => ({
      ...current,
      draftParts: current.draftParts.map((part) => (
        part.clientId !== partId
          ? part
          : {
            ...part,
            partType: nextType,
            fixedText: nextType === 'fixed_text' ? part.fixedText : '',
            formatPattern: supportsCustomIdFormatPattern(nextType) ? part.formatPattern : '',
          }
      )),
      validationErrors: {},
      previewErrorMessage: null,
      saveErrorMessage: null,
      isPreviewing: false,
    }))
  }, [clearConcurrencyProblem])

  const updateCustomIdPartFixedText = useCallback((partId: string, nextValue: string) => {
    customIdPreviewAbortRef.current?.abort()
    clearConcurrencyProblem()
    setCustomIdTemplateState((current) => ({
      ...current,
      draftParts: current.draftParts.map((part) => (
        part.clientId !== partId
          ? part
          : {
            ...part,
            fixedText: nextValue,
          }
      )),
      validationErrors: {},
      previewErrorMessage: null,
      saveErrorMessage: null,
      isPreviewing: false,
    }))
  }, [clearConcurrencyProblem])

  const updateCustomIdPartFormatPattern = useCallback((partId: string, nextValue: string) => {
    customIdPreviewAbortRef.current?.abort()
    clearConcurrencyProblem()
    setCustomIdTemplateState((current) => ({
      ...current,
      draftParts: current.draftParts.map((part) => (
        part.clientId !== partId
          ? part
          : {
            ...part,
            formatPattern: nextValue,
          }
      )),
      validationErrors: {},
      previewErrorMessage: null,
      saveErrorMessage: null,
      isPreviewing: false,
    }))
  }, [clearConcurrencyProblem])

  const moveSelectedCustomIdPartUp = useCallback(() => {
    customIdPreviewAbortRef.current?.abort()
    clearConcurrencyProblem()
    setCustomIdTemplateState((current) => {
      if (current.selectedPartId === null) {
        return current
      }

      const selectedIndex = current.draftParts.findIndex((part) => part.clientId === current.selectedPartId)
      if (selectedIndex <= 0) {
        return current
      }

      const nextDraftParts = [...current.draftParts]
      const [movedPart] = nextDraftParts.splice(selectedIndex, 1)
      nextDraftParts.splice(selectedIndex - 1, 0, movedPart)

      return {
        ...current,
        draftParts: nextDraftParts,
        validationErrors: {},
        previewErrorMessage: null,
        saveErrorMessage: null,
        isPreviewing: false,
      }
    })
  }, [clearConcurrencyProblem])

  const moveSelectedCustomIdPartDown = useCallback(() => {
    customIdPreviewAbortRef.current?.abort()
    clearConcurrencyProblem()
    setCustomIdTemplateState((current) => {
      if (current.selectedPartId === null) {
        return current
      }

      const selectedIndex = current.draftParts.findIndex((part) => part.clientId === current.selectedPartId)
      if (selectedIndex < 0 || selectedIndex >= current.draftParts.length - 1) {
        return current
      }

      const nextDraftParts = [...current.draftParts]
      const [movedPart] = nextDraftParts.splice(selectedIndex, 1)
      nextDraftParts.splice(selectedIndex + 1, 0, movedPart)

      return {
        ...current,
        draftParts: nextDraftParts,
        validationErrors: {},
        previewErrorMessage: null,
        saveErrorMessage: null,
        isPreviewing: false,
      }
    })
  }, [clearConcurrencyProblem])

  const removeSelectedCustomIdPart = useCallback(() => {
    customIdPreviewAbortRef.current?.abort()
    clearConcurrencyProblem()
    setCustomIdTemplateState((current) => {
      if (current.selectedPartId === null) {
        return current
      }

      const selectedIndex = current.draftParts.findIndex((part) => part.clientId === current.selectedPartId)
      if (selectedIndex < 0) {
        return current
      }

      const nextDraftParts = current.draftParts.filter((part) => part.clientId !== current.selectedPartId)
      const fallbackSelection = nextDraftParts[selectedIndex]?.clientId ?? nextDraftParts[selectedIndex - 1]?.clientId ?? null

      return {
        ...current,
        draftParts: nextDraftParts,
        selectedPartId: resolveSelectedCustomIdPartId(fallbackSelection, nextDraftParts),
        validationErrors: {},
        previewErrorMessage: null,
        saveErrorMessage: null,
        isPreviewing: false,
      }
    })
  }, [clearConcurrencyProblem])

  const resetCustomIdTemplateDraft = useCallback(() => {
    customIdPreviewAbortRef.current?.abort()
    clearConcurrencyProblem()
    setCustomIdTemplateState((current) => {
      const resetParts = [...current.persistedParts]
      return {
        ...current,
        draftIsEnabled: current.persistedIsEnabled,
        draftParts: resetParts,
        selectedPartId: resolveSelectedCustomIdPartId(current.selectedPartId, resetParts),
        derivedValidationRegex: current.derivedValidationRegex,
        previewSampleCustomId: current.previewSampleCustomId,
        previewWarnings: current.previewWarnings,
        validationErrors: {},
        previewErrorMessage: null,
        saveErrorMessage: null,
        isPreviewing: false,
      }
    })
  }, [clearConcurrencyProblem])

  const previewCustomIdTemplate = useCallback(async () => {
    if (inventoryId === null || !canManageCustomIdTemplate) {
      return
    }

    clearConcurrencyProblem()
    const payload = toCustomIdTemplateMutationPayload(
      customIdTemplateState.draftIsEnabled,
      customIdTemplateState.draftParts,
    )
    const clientErrors = validateCustomIdTemplatePayload(payload)
    if (hasErrors(clientErrors)) {
      setCustomIdTemplateState((current) => ({
        ...current,
        validationErrors: clientErrors,
        previewErrorMessage: firstError(clientErrors),
      }))
      return
    }

    customIdPreviewAbortRef.current?.abort()
    customIdPreviewRequestRef.current += 1
    const requestId = customIdPreviewRequestRef.current
    const abortController = new AbortController()
    customIdPreviewAbortRef.current = abortController

    setCustomIdTemplateState((current) => ({
      ...current,
      validationErrors: {},
      previewErrorMessage: null,
      saveErrorMessage: null,
      isPreviewing: true,
    }))

    const result = await previewInventoryCustomIdTemplate(inventoryId, payload, abortController.signal)
    if (abortController.signal.aborted || requestId !== customIdPreviewRequestRef.current) {
      return
    }

    if (!result.ok) {
      const serverErrors = result.problem?.errors ?? {}
      setCustomIdTemplateState((current) => ({
        ...current,
        validationErrors: serverErrors,
        previewErrorMessage: customIdPreviewFailureMessage(result),
        isPreviewing: false,
      }))
      return
    }

    setCustomIdTemplateState((current) => {
      const nextDraftParts = toCustomIdDraftPartsFromMutationResponse(
        result.data,
        current.draftParts,
        nextCustomIdPartClientId,
      )
      return {
        ...current,
        draftIsEnabled: result.data.isEnabled,
        draftParts: nextDraftParts,
        selectedPartId: resolveSelectedCustomIdPartId(current.selectedPartId, nextDraftParts),
        derivedValidationRegex: result.data.derivedValidationRegex,
        previewSampleCustomId: result.data.preview.sampleCustomId,
        previewWarnings: [...result.data.preview.warnings],
        validationErrors: {},
        previewErrorMessage: null,
        isPreviewing: false,
      }
    })
  }, [
    canManageCustomIdTemplate,
    clearConcurrencyProblem,
    customIdTemplateState.draftIsEnabled,
    customIdTemplateState.draftParts,
    inventoryId,
    nextCustomIdPartClientId,
  ])

  const saveCustomIdTemplate = useCallback(async () => {
    if (inventoryId === null || !canManageCustomIdTemplate) {
      return
    }

    clearConcurrencyProblem()
    const payload = toCustomIdTemplateMutationPayload(
      customIdTemplateState.draftIsEnabled,
      customIdTemplateState.draftParts,
    )
    const clientErrors = validateCustomIdTemplatePayload(payload)
    if (hasErrors(clientErrors)) {
      setCustomIdTemplateState((current) => ({
        ...current,
        validationErrors: clientErrors,
        saveErrorMessage: firstError(clientErrors),
      }))
      return
    }

    customIdPreviewAbortRef.current?.abort()
    setCustomIdTemplateState((current) => ({
      ...current,
      validationErrors: {},
      previewErrorMessage: null,
      saveErrorMessage: null,
      isPreviewing: false,
      isSaving: true,
    }))

    const result = await executeVersionedMutation((options) => (
      saveInventoryCustomIdTemplate(inventoryId, payload, options)
    ))

    if (result === null) {
      setCustomIdTemplateState((current) => ({
        ...current,
        isSaving: false,
        saveErrorMessage: versionStamp === null
          ? null
          : 'Another save operation is in progress. Retry after it completes.',
      }))
      return
    }

    if (!result.ok) {
      const serverErrors = result.problem?.errors ?? {}
      setCustomIdTemplateState((current) => ({
        ...current,
        validationErrors: serverErrors,
        saveErrorMessage: getConcurrencyProblem(result) === null ? customIdSaveFailureMessage(result) : null,
        isSaving: false,
      }))
      return
    }

    const nextDraftParts = toCustomIdDraftPartsFromMutationResponse(
      result.data,
      customIdTemplateState.draftParts,
      nextCustomIdPartClientId,
    )

    setCustomIdTemplateState((current) => ({
      ...current,
      draftIsEnabled: result.data.isEnabled,
      draftParts: nextDraftParts,
      persistedIsEnabled: result.data.isEnabled,
      persistedParts: nextDraftParts,
      selectedPartId: resolveSelectedCustomIdPartId(current.selectedPartId, nextDraftParts),
      derivedValidationRegex: result.data.derivedValidationRegex,
      previewSampleCustomId: result.data.preview.sampleCustomId,
      previewWarnings: [...result.data.preview.warnings],
      validationErrors: {},
      previewErrorMessage: null,
      saveErrorMessage: null,
      isSaving: false,
    }))

    setState((current) => {
      if (current.editor === null) {
        return current
      }

      return {
        ...current,
        editor: {
          ...current.editor,
          customIdTemplate: {
            ...current.editor.customIdTemplate,
            isEnabled: result.data.isEnabled,
            parts: nextDraftParts.map((part) => ({
              id: part.clientId,
              partType: part.partType,
              fixedText: normalizeOptional(part.fixedText),
              formatPattern: normalizeOptional(part.formatPattern),
            })),
            derivedValidationRegex: result.data.derivedValidationRegex,
            preview: {
              sampleCustomId: result.data.preview.sampleCustomId,
              warnings: [...result.data.preview.warnings],
            },
          },
        },
      }
    })
  }, [
    canManageCustomIdTemplate,
    clearConcurrencyProblem,
    customIdTemplateState.draftIsEnabled,
    customIdTemplateState.draftParts,
    executeVersionedMutation,
    inventoryId,
    nextCustomIdPartClientId,
    versionStamp,
  ])

  useEffect(() => {
    if (settingsTimerRef.current !== null) {
      clearTimeout(settingsTimerRef.current)
    }

    if (!canAutosaveSettings || !isSettingsDirty || isSettingsSaving || hasErrors(settingsFieldErrors)) {
      return
    }

    settingsTimerRef.current = setTimeout(() => {
      void saveSettings()
    }, settingsAutosaveIntervalMs)

    return () => {
      if (settingsTimerRef.current !== null) {
        clearTimeout(settingsTimerRef.current)
      }
    }
  }, [canAutosaveSettings, isSettingsDirty, isSettingsSaving, saveSettings, settingsFieldErrors])

  useEffect(() => {
    if (!isSettingsQueued || isSettingsSaving || !canAutosaveSettings || !isSettingsDirty || hasErrors(settingsFieldErrors)) {
      return
    }

    void saveSettings()
  }, [canAutosaveSettings, isSettingsDirty, isSettingsQueued, isSettingsSaving, saveSettings, settingsFieldErrors])

  useEffect(() => {
    if (tagsTimerRef.current !== null) {
      clearTimeout(tagsTimerRef.current)
    }

    if (!canAutosaveTags || !isTagsDirty || isTagsSaving || hasErrors(tagsFieldErrors)) {
      return
    }

    tagsTimerRef.current = setTimeout(() => {
      void saveTags()
    }, tagsAutosaveIntervalMs)

    return () => {
      if (tagsTimerRef.current !== null) {
        clearTimeout(tagsTimerRef.current)
      }
    }
  }, [canAutosaveTags, isTagsDirty, isTagsSaving, saveTags, tagsFieldErrors])

  useEffect(() => {
    if (!isTagsQueued || isTagsSaving || !canAutosaveTags || !isTagsDirty || hasErrors(tagsFieldErrors)) {
      return
    }

    void saveTags()
  }, [canAutosaveTags, isTagsDirty, isTagsQueued, isTagsSaving, saveTags, tagsFieldErrors])

  useEffect(() => {
    if (customFieldsTimerRef.current !== null) {
      clearTimeout(customFieldsTimerRef.current)
    }

    if (
      !canAutosaveCustomFields
      || !customFieldsState.isDirty
      || isCustomFieldsSaving
      || customFieldsState.validation.hasErrors
    ) {
      return
    }

    customFieldsTimerRef.current = setTimeout(() => {
      void saveCustomFields()
    }, inventoryCustomFieldsAutosaveContract.autosaveDelayMs)

    return () => {
      if (customFieldsTimerRef.current !== null) {
        clearTimeout(customFieldsTimerRef.current)
      }
    }
  }, [
    canAutosaveCustomFields,
    customFieldsState.changeToken,
    customFieldsState.isDirty,
    customFieldsState.validation.hasErrors,
    isCustomFieldsSaving,
    saveCustomFields,
  ])

  useEffect(() => {
    if (
      !isCustomFieldsQueued
      || isCustomFieldsSaving
      || !canAutosaveCustomFields
      || !customFieldsState.isDirty
      || customFieldsState.validation.hasErrors
    ) {
      return
    }

    void saveCustomFields()
  }, [
    canAutosaveCustomFields,
    customFieldsState.isDirty,
    customFieldsState.validation.hasErrors,
    isCustomFieldsQueued,
    isCustomFieldsSaving,
    saveCustomFields,
  ])

  const normalizedTabStates = useMemo(() => tabStates(state.editor), [state.editor])
  const normalizedActiveTabKey = useMemo(
    () => resolveActive(activeTabKey, normalizedTabStates),
    [activeTabKey, normalizedTabStates],
  )

  const settingsAutosave: InventorySettingsAutosaveState = useMemo(
    () => ({
      draft: settingsDraft,
      dirtyFields: settingsDirtyFields,
      fieldErrors: settingsFieldErrors,
      isDirty: isSettingsDirty,
      isSaving: isSettingsSaving,
      isQueued: isSettingsQueued,
      canAutosave: canAutosaveSettings,
      lastSavedAt: settingsLastSavedAt,
      errorMessage: settingsErrorMessage,
      autosaveIntervalMs: settingsAutosaveIntervalMs,
      imageUpload: settingsImageUpload,
    }),
    [
      canAutosaveSettings,
      isSettingsDirty,
      isSettingsQueued,
      isSettingsSaving,
      settingsDirtyFields,
      settingsDraft,
      settingsErrorMessage,
      settingsFieldErrors,
      settingsImageUpload,
      settingsLastSavedAt,
    ],
  )
  const tagsAutosave: InventoryTagsAutosaveState = useMemo(
    () => ({
      draft: tagsDraft,
      fieldErrors: tagsFieldErrors,
      isDirty: isTagsDirty,
      isSaving: isTagsSaving,
      isQueued: isTagsQueued,
      canAutosave: canAutosaveTags,
      lastSavedAt: tagsLastSavedAt,
      errorMessage: tagsErrorMessage,
      autosaveIntervalMs: tagsAutosaveIntervalMs,
    }),
    [
      canAutosaveTags,
      isTagsDirty,
      isTagsQueued,
      isTagsSaving,
      tagsDraft,
      tagsErrorMessage,
      tagsFieldErrors,
      tagsLastSavedAt,
    ],
  )
  const customIdTemplate = useMemo<InventoryCustomIdTemplateBuilderModel>(
    () => ({
      isEnabled: customIdTemplateState.draftIsEnabled,
      parts: customIdTemplateState.draftParts,
      selectedPartId: customIdTemplateState.selectedPartId,
      derivedValidationRegex: customIdTemplateState.derivedValidationRegex,
      previewSampleCustomId: customIdTemplateState.previewSampleCustomId,
      previewWarnings: customIdTemplateState.previewWarnings,
      validationErrors: customIdTemplateState.validationErrors,
      previewErrorMessage: customIdTemplateState.previewErrorMessage,
      saveErrorMessage: customIdTemplateState.saveErrorMessage,
      concurrencyProblem,
      isPreviewing: customIdTemplateState.isPreviewing,
      isSaving: customIdTemplateState.isSaving,
      isDirty: isCustomIdTemplateDirty,
      setIsEnabled: setCustomIdEnabled,
      selectPart: selectCustomIdPart,
      addPart: addCustomIdPart,
      updatePartType: updateCustomIdPartType,
      updatePartFixedText: updateCustomIdPartFixedText,
      updatePartFormatPattern: updateCustomIdPartFormatPattern,
      moveSelectedPartUp: moveSelectedCustomIdPartUp,
      moveSelectedPartDown: moveSelectedCustomIdPartDown,
      removeSelectedPart: removeSelectedCustomIdPart,
      resetDraft: resetCustomIdTemplateDraft,
      previewTemplate: previewCustomIdTemplate,
      saveTemplate: saveCustomIdTemplate,
    }),
    [
      addCustomIdPart,
      concurrencyProblem,
      customIdTemplateState.draftIsEnabled,
      customIdTemplateState.draftParts,
      customIdTemplateState.derivedValidationRegex,
      customIdTemplateState.isPreviewing,
      customIdTemplateState.isSaving,
      customIdTemplateState.previewErrorMessage,
      customIdTemplateState.previewSampleCustomId,
      customIdTemplateState.previewWarnings,
      customIdTemplateState.saveErrorMessage,
      customIdTemplateState.selectedPartId,
      customIdTemplateState.validationErrors,
      isCustomIdTemplateDirty,
      moveSelectedCustomIdPartDown,
      moveSelectedCustomIdPartUp,
      previewCustomIdTemplate,
      removeSelectedCustomIdPart,
      resetCustomIdTemplateDraft,
      saveCustomIdTemplate,
      selectCustomIdPart,
      setCustomIdEnabled,
      updateCustomIdPartFixedText,
      updateCustomIdPartFormatPattern,
      updateCustomIdPartType,
    ],
  )

  const setSelectedCustomFieldKey = useCallback(
    (fieldKey: string | null) => {
      clearConcurrencyProblem()
      setCustomFieldsState((current) => ({
        ...current,
        selectedFieldKey: resolveSelectedCustomFieldKey(fieldKey, current.draftFields),
      }))
    },
    [clearConcurrencyProblem],
  )

  const addCustomFieldDraft = useCallback(() => {
    clearConcurrencyProblem()
    setCustomFieldsState((current) => {
      customFieldDraftKeyRef.current += 1
      const preferredFieldType = findPreferredFieldType(current.draftFields)
      const newField: InventoryEditorCustomFieldDraft = {
        key: `new:${String(customFieldDraftKeyRef.current)}`,
        id: null,
        fieldType: preferredFieldType,
        title: '',
        description: '',
        showInTable: false,
      }

      return buildCustomFieldsStateFromDraft(current, [...current.draftFields, newField], newField.key)
    })

    if (isCustomFieldsSaving) {
      setIsCustomFieldsQueued(true)
    }
  }, [clearConcurrencyProblem, isCustomFieldsSaving])

  const updateCustomFieldDraft = useCallback(
    (
      fieldKey: string,
      patch: Partial<Pick<InventoryEditorCustomFieldDraft, 'fieldType' | 'title' | 'description' | 'showInTable'>>,
    ) => {
      clearConcurrencyProblem()
      setCustomFieldsState((current) => {
        const nextDraftFields = current.draftFields.map((field) => (
          field.key !== fieldKey
            ? field
            : {
              ...field,
              fieldType: patch.fieldType ?? field.fieldType,
              title: patch.title ?? field.title,
              description: patch.description ?? field.description,
              showInTable: patch.showInTable ?? field.showInTable,
            }
        ))

        return buildCustomFieldsStateFromDraft(current, nextDraftFields, fieldKey)
      })

      if (isCustomFieldsSaving) {
        setIsCustomFieldsQueued(true)
      }
    },
    [clearConcurrencyProblem, isCustomFieldsSaving],
  )

  const removeSelectedCustomFieldDraft = useCallback(() => {
    clearConcurrencyProblem()
    setCustomFieldsState((current) => {
      if (current.selectedFieldKey === null) {
        return current
      }

      const index = current.draftFields.findIndex((field) => field.key === current.selectedFieldKey)
      if (index < 0) {
        return current
      }

      const nextDraftFields = current.draftFields.filter((field) => field.key !== current.selectedFieldKey)
      const fallbackSelection = nextDraftFields[index]?.key ?? nextDraftFields[index - 1]?.key ?? null
      return buildCustomFieldsStateFromDraft(current, nextDraftFields, fallbackSelection)
    })

    if (isCustomFieldsSaving) {
      setIsCustomFieldsQueued(true)
    }
  }, [clearConcurrencyProblem, isCustomFieldsSaving])

  const moveSelectedCustomFieldDraftUp = useCallback(() => {
    clearConcurrencyProblem()
    setCustomFieldsState((current) => {
      if (current.selectedFieldKey === null) {
        return current
      }

      const index = current.draftFields.findIndex((field) => field.key === current.selectedFieldKey)
      if (index <= 0) {
        return current
      }

      const nextDraftFields = moveCustomField(current.draftFields, index, index - 1)
      return buildCustomFieldsStateFromDraft(current, nextDraftFields, current.selectedFieldKey)
    })

    if (isCustomFieldsSaving) {
      setIsCustomFieldsQueued(true)
    }
  }, [clearConcurrencyProblem, isCustomFieldsSaving])

  const moveSelectedCustomFieldDraftDown = useCallback(() => {
    clearConcurrencyProblem()
    setCustomFieldsState((current) => {
      if (current.selectedFieldKey === null) {
        return current
      }

      const index = current.draftFields.findIndex((field) => field.key === current.selectedFieldKey)
      if (index < 0 || index >= current.draftFields.length - 1) {
        return current
      }

      const nextDraftFields = moveCustomField(current.draftFields, index, index + 1)
      return buildCustomFieldsStateFromDraft(current, nextDraftFields, current.selectedFieldKey)
    })

    if (isCustomFieldsSaving) {
      setIsCustomFieldsQueued(true)
    }
  }, [clearConcurrencyProblem, isCustomFieldsSaving])

  const resetCustomFieldDrafts = useCallback(() => {
    clearConcurrencyProblem()
    setIsCustomFieldsQueued(false)
    setCustomFieldsState((current) => {
      const nextDraftFields = [...current.persistedFields]
      const validation = validateCustomFieldDrafts(nextDraftFields)
      return {
        ...current,
        draftFields: nextDraftFields,
        selectedFieldKey: resolveSelectedCustomFieldKey(current.selectedFieldKey, nextDraftFields),
        validation,
        isDirty: false,
        saveStatus: 'idle',
        saveErrorMessage: null,
        changeToken: current.changeToken + 1,
      }
    })
  }, [clearConcurrencyProblem])

  return useMemo(
    () => ({
      ...state,
      etag: versionStamp?.etag ?? null,
      activeTabKey: normalizedActiveTabKey,
      tabStates: normalizedTabStates,
      categoryOptions: references.categoryOptions,
      referencesStatus: references.status,
      referencesErrorMessage: references.errorMessage,
      retryReferences: references.retryBootstrap,
      concurrencyProblem,
      settingsAutosave,
      tagsAutosave,
      customIdTemplate,
      customFieldDrafts: customFieldsState.draftFields,
      selectedCustomFieldKey: customFieldsState.selectedFieldKey,
      customFieldValidationByKey: customFieldsState.validation.byFieldKey,
      customFieldGlobalValidationErrors: customFieldsState.validation.globalErrors,
      customFieldsSaveStatus: customFieldsState.saveStatus,
      customFieldsSaveErrorMessage: customFieldsState.saveErrorMessage,
      customFieldsLastSavedAt: customFieldsState.lastSavedAt,
      isCustomFieldsMutating: isCustomFieldsSaving,
      deleteFlow: {
        isDeleting: isDeletingInventory,
        errorMessage: deleteErrorMessage,
      },
      updateSettingsDraft: (patch: Partial<InventoryEditorSettingsDraft>) => {
        applySettingsDraftPatch(patch)
      },
      uploadSettingsImage,
      deleteSettingsImageFromStorage,
      cancelSettingsImageUpload,
      deleteInventory,
      saveSettingsNow: () => {
        if (settingsTimerRef.current !== null) {
          clearTimeout(settingsTimerRef.current)
        }
        void saveSettings()
      },
      resetSettingsDraft: () => {
        settingsImageUploadAbortRef.current?.abort()
        settingsImageUploadAbortRef.current = null
        clearConcurrencyProblem()
        setSettingsErrorMessage(null)
        setSettingsFieldErrors({})
        setIsSettingsQueued(false)
        setSettingsImageUpload(createInitialSettingsImageUploadState())
        if (persistedSettingsDraft !== null) {
          setSettingsDraft({ ...persistedSettingsDraft })
        }
      },
      updateTagsDraft: (nextTags: ReadonlyArray<string>) => {
        clearConcurrencyProblem()
        setTagsErrorMessage(null)
        setTagsFieldErrors({})
        setTagsDraft(normalizeTags(nextTags))
        if (isTagsSaving) {
          setIsTagsQueued(true)
        }
      },
      saveTagsNow: () => {
        if (tagsTimerRef.current !== null) {
          clearTimeout(tagsTimerRef.current)
        }
        void saveTags()
      },
      resetTagsDraft: () => {
        clearConcurrencyProblem()
        setTagsErrorMessage(null)
        setTagsFieldErrors({})
        setIsTagsQueued(false)
        setTagsDraft([...persistedTags])
      },
      setSelectedCustomFieldKey,
      addCustomFieldDraft,
      updateCustomFieldDraft,
      removeSelectedCustomFieldDraft,
      moveSelectedCustomFieldDraftUp,
      moveSelectedCustomFieldDraftDown,
      resetCustomFieldDrafts,
      setActiveTabKey,
      clearConcurrencyProblem,
      retryLoad,
    }),
    [
      addCustomFieldDraft,
      applySettingsDraftPatch,
      cancelSettingsImageUpload,
      clearConcurrencyProblem,
      concurrencyProblem,
      customFieldsState.draftFields,
      customFieldsState.lastSavedAt,
      customFieldsState.saveErrorMessage,
      customFieldsState.saveStatus,
      customFieldsState.selectedFieldKey,
      customFieldsState.validation.byFieldKey,
      customFieldsState.validation.globalErrors,
      customIdTemplate,
      deleteErrorMessage,
      deleteInventory,
      deleteSettingsImageFromStorage,
      isCustomFieldsSaving,
      isDeletingInventory,
      isTagsSaving,
      moveSelectedCustomFieldDraftDown,
      moveSelectedCustomFieldDraftUp,
      normalizedActiveTabKey,
      normalizedTabStates,
      persistedSettingsDraft,
      persistedTags,
      references.categoryOptions,
      references.errorMessage,
      references.retryBootstrap,
      references.status,
      removeSelectedCustomFieldDraft,
      resetCustomFieldDrafts,
      retryLoad,
      saveSettings,
      saveTags,
      setSelectedCustomFieldKey,
      settingsAutosave,
      setSettingsImageUpload,
      state,
      tagsAutosave,
      uploadSettingsImage,
      updateCustomFieldDraft,
      versionStamp?.etag,
    ],
  )
}
