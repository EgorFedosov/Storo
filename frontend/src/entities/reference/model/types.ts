export interface SystemHealthStatus {
  message: string
  utcNow: string
}

export interface InventoryCategoryReference {
  id: number
  name: string
}

export interface InventoryCategoryOption {
  value: number
  label: string
}
