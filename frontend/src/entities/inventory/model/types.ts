export type InventoryDetailsCategory = {
  id: number
  name: string
}

export type InventoryDetailsHeader = {
  title: string
  descriptionMarkdown: string
  category: InventoryDetailsCategory
  imageUrl: string | null
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

export type InventoryDetailsCreator = {
  id: string
  userName: string
  displayName: string
}

export type InventoryDetailsTag = {
  id: string
  name: string
}

export type InventoryDetailsSummary = {
  itemsCount: number
}

export type InventoryDetailsPermissions = {
  canEditInventory: boolean
  canManageAccess: boolean
  canManageCustomFields: boolean
  canManageCustomIdTemplate: boolean
  canWriteItems: boolean
  canComment: boolean
  canLike: boolean
}

export type InventoryDetails = {
  id: string
  version: number
  header: InventoryDetailsHeader
  creator: InventoryDetailsCreator
  tags: ReadonlyArray<InventoryDetailsTag>
  summary: InventoryDetailsSummary
  permissions: InventoryDetailsPermissions
}
