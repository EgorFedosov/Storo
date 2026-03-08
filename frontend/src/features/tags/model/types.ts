export type TagReference = {
  id: string
  name: string
}

export type TagCloudEntry = TagReference & {
  count: number
}

