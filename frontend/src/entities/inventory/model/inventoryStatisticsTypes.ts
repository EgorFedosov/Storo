export type InventoryNumericFieldStatistics = {
  fieldId: string
  title: string
  min: number | null
  max: number | null
  avg: number | null
}

export type InventoryStringFieldStatistics = {
  fieldId: string
  title: string
  mostFrequentValue: string | null
  mostFrequentCount: number
}

export type InventoryStatistics = {
  inventoryId: string
  updatedAt: string
  itemsCount: number
  numericFields: ReadonlyArray<InventoryNumericFieldStatistics>
  stringFields: ReadonlyArray<InventoryStringFieldStatistics>
}
