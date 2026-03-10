export type InventoryDiscussionPostAuthor = {
  id: string
  userName: string
  displayName: string
}

export type InventoryDiscussionPost = {
  id: string
  contentMarkdown: string
  createdAt: string
  author: InventoryDiscussionPostAuthor
}

export type InventoryDiscussionPostsPage = {
  inventoryId: string
  posts: ReadonlyArray<InventoryDiscussionPost>
  hasMore: boolean
}

export type InventoryDiscussionPostedEvent = {
  event: 'discussion.posted'
  inventoryId: string
  post: InventoryDiscussionPost
}
