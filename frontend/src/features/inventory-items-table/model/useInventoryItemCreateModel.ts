import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createInventoryItem,
  type CreateInventoryItemFieldPayload,
  type CreateInventoryItemRequestResult,
  type InventoryItemDetails,
} from '../../../entities/inventory/model/inventoryItemCreateApi.ts'
import type { InventoryCustomFieldType } from '../../../entities/inventory/model/inventoryEditorTypes.ts'

type ValidationErrors = Record<string, string[]>

export const inventoryItemCreateContract = {
  maxCustomIdLength: 500,
  maxSingleLineLength: 1_000,
  maxMultiLineLength: 10_000,
  maxLinkLength: 2_048,
  maxNumberDecimals: 4,
  minNumberValue: -99_999_999_999_999.9999,
  maxNumberValue: 99_999_999_999_999.9999,
} as const

export type InventoryItemCreateFieldDefinition = {
  fieldId: string
  title: string
  fieldType: InventoryCustomFieldType
}

export type InventoryItemCreateInput = {
  customId: string
  fields: Record<string, unknown>
}

export type InventoryItemCreateSuccess = {
  ok: true
  item: InventoryItemDetails
  etag: string | null
}

export type InventoryItemCreateFailure = {
  ok: false
  cancelled: boolean
  code: string | null
  errorMessage: string | null
  fieldErrors: ValidationErrors
}

export type InventoryItemCreateSubmitResult = InventoryItemCreateSuccess | InventoryItemCreateFailure

type LastCreatedItemState = {
  item: InventoryItemDetails
  etag: string | null
}

function hasAnyErrors(errors: ValidationErrors): boolean {
  return Object.values(errors).some((messages) => messages.length > 0)
}

function pickFirstError(errors: ValidationErrors): string | null {
  for (const messages of Object.values(errors)) {
    if (messages.length > 0) {
      return messages[0]
    }
  }

  return null
}

function normalizeOptionalCustomId(rawCustomId: string): string | null {
  const normalizedValue = rawCustomId.trim()
  return normalizedValue.length > 0 ? normalizedValue : null
}

function normalizeOptionalStringField(rawValue: unknown): string | null {
  if (typeof rawValue !== 'string') {
    return null
  }

  return rawValue.trim().length > 0 ? rawValue : null
}

function normalizeNumberField(rawValue: unknown): number | null {
  if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
    return null
  }

  return rawValue
}

function countNumberDecimals(value: number): number {
  const normalizedValue = value.toString()
  const decimalSeparatorIndex = normalizedValue.indexOf('.')
  if (decimalSeparatorIndex < 0) {
    return 0
  }

  return normalizedValue.length - decimalSeparatorIndex - 1
}

function validateFieldValue(
  field: InventoryItemCreateFieldDefinition,
  rawValue: unknown,
): string | null {
  if (field.fieldType === 'bool') {
    if (typeof rawValue === 'boolean' || rawValue === undefined) {
      return null
    }

    return 'Boolean value must be true or false.'
  }

  if (field.fieldType === 'number') {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return null
    }

    if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
      return 'Number value must be numeric.'
    }

    if (countNumberDecimals(rawValue) > inventoryItemCreateContract.maxNumberDecimals) {
      return `Number value must have at most ${String(inventoryItemCreateContract.maxNumberDecimals)} decimal places.`
    }

    if (
      rawValue < inventoryItemCreateContract.minNumberValue
      || rawValue > inventoryItemCreateContract.maxNumberValue
    ) {
      return 'Number value is out of supported range.'
    }

    return null
  }

  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return null
  }

  if (typeof rawValue !== 'string') {
    return 'Text value must be a string.'
  }

  const valueLength = rawValue.length

  if (field.fieldType === 'single_line' && valueLength > inventoryItemCreateContract.maxSingleLineLength) {
    return `Single-line value must be ${String(inventoryItemCreateContract.maxSingleLineLength)} characters or less.`
  }

  if (field.fieldType === 'multi_line' && valueLength > inventoryItemCreateContract.maxMultiLineLength) {
    return `Multi-line value must be ${String(inventoryItemCreateContract.maxMultiLineLength)} characters or less.`
  }

  if (field.fieldType === 'link' && valueLength > inventoryItemCreateContract.maxLinkLength) {
    return `Link value must be ${String(inventoryItemCreateContract.maxLinkLength)} characters or less.`
  }

  return null
}

function validateInput(
  input: InventoryItemCreateInput,
  fieldDefinitions: ReadonlyArray<InventoryItemCreateFieldDefinition>,
): ValidationErrors {
  const errors: ValidationErrors = {}

  const normalizedCustomId = normalizeOptionalCustomId(input.customId)
  if (normalizedCustomId !== null && normalizedCustomId.length > inventoryItemCreateContract.maxCustomIdLength) {
    errors.customId = [`customId must be ${String(inventoryItemCreateContract.maxCustomIdLength)} characters or less.`]
  }

  for (const field of fieldDefinitions) {
    const rawValue = input.fields[field.fieldId]
    const fieldError = validateFieldValue(field, rawValue)
    if (fieldError !== null) {
      errors[`fields.${field.fieldId}`] = [fieldError]
    }
  }

  return errors
}

function toRequestFieldValue(
  fieldType: InventoryCustomFieldType,
  rawValue: unknown,
): CreateInventoryItemFieldPayload['value'] {
  if (fieldType === 'bool') {
    return typeof rawValue === 'boolean' ? rawValue : false
  }

  if (fieldType === 'number') {
    return normalizeNumberField(rawValue)
  }

  return normalizeOptionalStringField(rawValue)
}

function toRequestPayload(
  input: InventoryItemCreateInput,
  fieldDefinitions: ReadonlyArray<InventoryItemCreateFieldDefinition>,
): {
  customId: string | null
  fields: ReadonlyArray<CreateInventoryItemFieldPayload>
} {
  return {
    customId: normalizeOptionalCustomId(input.customId),
    fields: fieldDefinitions.map((field) => ({
      fieldId: field.fieldId,
      value: toRequestFieldValue(field.fieldType, input.fields[field.fieldId]),
    })),
  }
}

function normalizeFailureMessage(
  failure: Exclude<CreateInventoryItemRequestResult, { ok: true }>,
  fieldErrors: ValidationErrors,
): string {
  if (failure.status === 401) {
    return 'Sign in to create items.'
  }

  if (failure.status === 403) {
    return 'You do not have permission to create items in this inventory.'
  }

  if (failure.status === 404) {
    return 'Inventory was not found.'
  }

  if (failure.code === 'duplicate_custom_id' || failure.status === 409) {
    return 'customId is already used in this inventory. Enter another value and retry.'
  }

  const validationMessage = pickFirstError(fieldErrors)
  if (validationMessage !== null) {
    return validationMessage
  }

  return failure.message
}

export function useInventoryItemCreateModel(inventoryId: string) {
  const requestSequenceRef = useRef(0)
  const requestAbortControllerRef = useRef<AbortController | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null)
  const [lastCreatedItem, setLastCreatedItem] = useState<LastCreatedItemState | null>(null)

  useEffect(() => () => {
    requestAbortControllerRef.current?.abort()
  }, [])

  const cancelInFlight = useCallback(() => {
    requestAbortControllerRef.current?.abort()
  }, [])

  const resetSubmitState = useCallback(() => {
    setSubmitErrorMessage(null)
  }, [])

  const clearLastCreatedItem = useCallback(() => {
    setLastCreatedItem(null)
  }, [])

  const submit = useCallback(async (
    input: InventoryItemCreateInput,
    fieldDefinitions: ReadonlyArray<InventoryItemCreateFieldDefinition>,
  ): Promise<InventoryItemCreateSubmitResult> => {
    const clientValidationErrors = validateInput(input, fieldDefinitions)
    if (hasAnyErrors(clientValidationErrors)) {
      const errorMessage = pickFirstError(clientValidationErrors)
      setSubmitErrorMessage(errorMessage)

      return {
        ok: false,
        cancelled: false,
        code: null,
        errorMessage,
        fieldErrors: clientValidationErrors,
      }
    }

    requestSequenceRef.current += 1
    const requestId = requestSequenceRef.current

    requestAbortControllerRef.current?.abort()
    const abortController = new AbortController()
    requestAbortControllerRef.current = abortController

    setIsSubmitting(true)
    setSubmitErrorMessage(null)

    try {
      const result = await createInventoryItem(
        inventoryId,
        toRequestPayload(input, fieldDefinitions),
        abortController.signal,
      )

      if (abortController.signal.aborted || requestId !== requestSequenceRef.current) {
        return {
          ok: false,
          cancelled: true,
          code: null,
          errorMessage: null,
          fieldErrors: {},
        }
      }

      if (!result.ok) {
        const fieldErrors = {
          ...result.validationErrors,
        }

        if ((result.code === 'duplicate_custom_id' || result.status === 409) && fieldErrors.customId === undefined) {
          fieldErrors.customId = ['customId is already used in this inventory.']
        }

        const errorMessage = normalizeFailureMessage(result, fieldErrors)
        setSubmitErrorMessage(errorMessage)

        return {
          ok: false,
          cancelled: false,
          code: result.code,
          errorMessage,
          fieldErrors,
        }
      }

      setSubmitErrorMessage(null)
      setLastCreatedItem({
        item: result.item,
        etag: result.etag,
      })

      return {
        ok: true,
        item: result.item,
        etag: result.etag,
      }
    } finally {
      if (!abortController.signal.aborted && requestId === requestSequenceRef.current) {
        setIsSubmitting(false)
      }
    }
  }, [inventoryId])

  return {
    isSubmitting,
    submitErrorMessage,
    lastCreatedItem,
    resetSubmitState,
    clearLastCreatedItem,
    cancelInFlight,
    submit,
  }
}

