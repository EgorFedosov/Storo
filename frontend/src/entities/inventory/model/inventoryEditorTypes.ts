export type InventoryEditorCategory = {
  id: number
  name: string
}

export type InventoryEditorSettings = {
  title: string
  descriptionMarkdown: string
  category: InventoryEditorCategory
  imageUrl: string | null
}

export type InventoryEditorTag = {
  id: string
  name: string
}

export type InventoryEditorAccessMode = 'public' | 'restricted'

export type InventoryEditorWriter = {
  id: string
  userName: string
  displayName: string
  email: string
  isBlocked: boolean
}

export type InventoryEditorAccess = {
  mode: InventoryEditorAccessMode
  writers: ReadonlyArray<InventoryEditorWriter>
}

export type InventoryCustomFieldType = 'single_line' | 'multi_line' | 'number' | 'link' | 'bool'

export type InventoryEditorCustomField = {
  id: string
  fieldType: InventoryCustomFieldType
  title: string
  description: string
  showInTable: boolean
}

export type InventoryCustomIdPartType =
  | 'fixed_text'
  | 'random_20_bit'
  | 'random_32_bit'
  | 'random_6_digit'
  | 'random_9_digit'
  | 'guid'
  | 'datetime'
  | 'sequence'

export type InventoryEditorCustomIdTemplatePart = {
  id: string
  partType: InventoryCustomIdPartType
  fixedText: string | null
  formatPattern: string | null
}

export type InventoryEditorCustomIdTemplatePreview = {
  sampleCustomId: string
  warnings: ReadonlyArray<string>
}

export type InventoryEditorCustomIdTemplate = {
  isEnabled: boolean
  parts: ReadonlyArray<InventoryEditorCustomIdTemplatePart>
  derivedValidationRegex: string | null
  preview: InventoryEditorCustomIdTemplatePreview
}

export type InventoryEditorPermissions = {
  canEditInventory: boolean
  canManageAccess: boolean
  canManageCustomFields: boolean
  canManageCustomIdTemplate: boolean
  canWriteItems: boolean
}

export type InventoryEditorOdooIntegration = {
  enabled: boolean
  canViewToken: boolean
  canGenerateToken: boolean
  tokenActionUrl: string | null
  hasActiveToken: boolean
  maskedToken: string | null
  generatedAt: string | null
}

export type InventoryEditorIntegrations = {
  odoo: InventoryEditorOdooIntegration
}

export type InventoryOdooToken = {
  inventoryId: string | null
  plainToken: string | null
  maskedToken: string | null
  createdAt: string
}

export type InventoryEditor = {
  id: string
  version: number
  settings: InventoryEditorSettings
  tags: ReadonlyArray<InventoryEditorTag>
  access: InventoryEditorAccess
  customFields: ReadonlyArray<InventoryEditorCustomField>
  customIdTemplate: InventoryEditorCustomIdTemplate
  integrations: InventoryEditorIntegrations
  permissions: InventoryEditorPermissions
}
