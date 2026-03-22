import type { IntegrationProvider } from './contracts.ts'

export type InventoryOdooTokenResponse = {
  inventoryId: string | null
  plainToken: string | null
  maskedToken: string | null
  createdAt: string
}

export type CreateSupportTicketRequest = {
  summary: string | null
  priority: string | null
  pageLink: string | null
  inventoryId: string | null
  provider: IntegrationProvider
}

export type CreateSupportTicketResponse = {
  ticketId: string | null
  provider: string | null
  status: string | null
  uploadedFileRef: string | null
  createdAtUtc: string
}

export type GetSupportTicketStatusResponse = {
  ticketId: string | null
  provider: string | null
  status: string | null
  uploadedFileRef: string | null
  errorMessage: string | null
  createdAtUtc: string
  uploadedAtUtc: string | null
}

export type SyncSalesforceContactRequest = {
  companyName: string | null
  jobTitle: string | null
  phone: string | null
  country: string | null
  notes: string | null
}

export type SyncSalesforceContactResponse = {
  syncStatus: string | null
  sfAccountId: string | null
  sfContactId: string | null
  syncedAt: string
  errorMessage: string | null
}

export type GetSalesforceMeResponse = {
  isLinked: boolean
  sfAccountId: string | null
  sfContactId: string | null
  lastSyncStatus: string | null
  lastSyncedAt: string | null
}

