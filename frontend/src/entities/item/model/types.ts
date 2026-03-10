import type { InventoryCustomFieldType } from '../../inventory/model/inventoryEditorTypes.ts'

export type ItemFieldValue = string | number | boolean | null

export type ItemUserSummary = {
  id: string
  userName: string
  displayName: string
}

export type ItemDetails = {
  id: string
  inventory: {
    id: string
    title: string
  }
  customId: string
  version: number
  fixedFields: {
    createdAt: string
    updatedAt: string
    createdBy: ItemUserSummary | null
    updatedBy: ItemUserSummary | null
  }
  fields: ReadonlyArray<{
    fieldId: string
    fieldType: InventoryCustomFieldType
    title: string
    description: string
    value: ItemFieldValue
  }>
  like: {
    count: number
    likedByCurrentUser: boolean
  }
  permissions: {
    canEdit: boolean
    canDelete: boolean
    canLike: boolean
  }
}

export type UpdateItemFieldPayload = {
  fieldId: string
  value: ItemFieldValue
}

export type UpdateItemPayload = {
  customId: string
  fields: ReadonlyArray<UpdateItemFieldPayload>
}
