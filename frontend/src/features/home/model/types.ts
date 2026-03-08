export type HomePageStatus = 'loading' | 'ready' | 'error'

export type HomeInventoryCreator = {
  id: string
  userName: string
  displayName: string
}

export type HomeInventorySummary = {
  id: string
  title: string
  descriptionMarkdown: string
  imageUrl: string | null
  itemsCount: number
  createdAt: string
  updatedAt: string
  creator: HomeInventoryCreator
}

export type HomeTagCloudItem = {
  id: string
  name: string
  count: number
}

export type HomePageData = {
  latestInventories: HomeInventorySummary[]
  topPopularInventories: HomeInventorySummary[]
  tagCloud: HomeTagCloudItem[]
}

export type HomePageModelState = {
  status: HomePageStatus
  data: HomePageData
  errorMessage: string | null
}
