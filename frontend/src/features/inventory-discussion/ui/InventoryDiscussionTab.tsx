import {
  Alert,
  Button,
  Empty,
  Input,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { TableProps } from 'antd'
import dayjs from 'dayjs'
import { useCallback, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useCurrentUser } from '../../auth/model/useCurrentUser.ts'
import { useInventoryDiscussionModel } from '../model/useInventoryDiscussionModel.ts'

type InventoryDiscussionTabProps = {
  inventoryId: string
  canComment: boolean
  enabled: boolean
}

type DiscussionRow = {
  key: string
  id: string
  createdAt: string
  authorDisplayName: string
  authorUserName: string
  contentMarkdown: string
}

function formatCreatedAt(value: string): string {
  const parsedValue = dayjs(value)
  return parsedValue.isValid() ? parsedValue.format('DD.MM.YYYY HH:mm:ss [UTC]') : value
}

function toRows(posts: ReadonlyArray<{ id: string; createdAt: string; author: { displayName: string; userName: string }; contentMarkdown: string }>): DiscussionRow[] {
  return posts.map((post) => ({
    key: post.id,
    id: post.id,
    createdAt: post.createdAt,
    authorDisplayName: post.author.displayName,
    authorUserName: post.author.userName,
    contentMarkdown: post.contentMarkdown,
  }))
}

export function InventoryDiscussionTab({ inventoryId, canComment, enabled }: InventoryDiscussionTabProps) {
  const { isAuthenticated } = useCurrentUser()
  const [draftPost, setDraftPost] = useState('')

  const canSubmitPost = canComment && isAuthenticated

  const {
    status,
    posts,
    errorMessage,
    isPosting,
    postErrorMessage,
    realtimeErrorMessage,
    retryLoad,
    submitPost,
    clearPostError,
  } = useInventoryDiscussionModel(inventoryId, enabled, canSubmitPost)

  const rows = useMemo(() => toRows(posts), [posts])

  const columns = useMemo<NonNullable<TableProps<DiscussionRow>['columns']>>(
    () => [
      {
        title: 'Создано',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 220,
        render: (value: string) => formatCreatedAt(value),
      },
      {
        title: 'Автор',
        dataIndex: 'authorDisplayName',
        key: 'author',
        width: 220,
        render: (_, row) => (
          <Space direction="vertical" size={0}>
            <Typography.Text>{row.authorDisplayName}</Typography.Text>
            <Typography.Text type="secondary">@{row.authorUserName}</Typography.Text>
          </Space>
        ),
      },
      {
        title: 'Сообщение',
        dataIndex: 'contentMarkdown',
        key: 'contentMarkdown',
        render: (value: string) => (
          <div className="inventory-discussion-markdown">
            <ReactMarkdown>{value}</ReactMarkdown>
          </div>
        ),
      },
      {
        title: 'ID поста',
        dataIndex: 'id',
        key: 'id',
        width: 140,
      },
    ],
    [],
  )

  const handleSubmit = useCallback(async () => {
    const submitted = await submitPost(draftPost)
    if (submitted) {
      setDraftPost('')
    }
  }, [draftPost, submitPost])

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Space size={8} wrap>
        <Tag className="inventory-meta-tag">Инвентарь #{inventoryId}</Tag>
        <Tag className="inventory-meta-tag">Посты: {String(rows.length)}</Tag>
      </Space>

      {realtimeErrorMessage !== null ? (
        <Alert
          showIcon
          type="warning"
          message="Канал обновлений недоступен"
          description={realtimeErrorMessage}
        />
      ) : null}

      {errorMessage !== null ? (
        <Alert
          showIcon
          type="error"
          message="Не удалось загрузить историю обсуждения"
          description={errorMessage}
          action={(
            <Button type="primary" size="small" onClick={retryLoad}>
              Повторить
            </Button>
          )}
        />
      ) : null}

      <Space size={8} wrap>
      </Space>

      <Table<DiscussionRow>
        rowKey="key"
        columns={columns}
        dataSource={rows}
        loading={status === 'loading'}
        pagination={false}
        size="middle"
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Постов в обсуждении пока нет."
            />
          ),
        }}
      />

      {!canSubmitPost ? (
        <Alert
          showIcon
          type="info"
          message="Публикация недоступна"
          description={isAuthenticated
            ? 'У вашей учетной записи нет прав публиковать сообщения в этом обсуждении.'
            : 'Войдите, чтобы публиковать сообщения в обсуждении.'}
        />
      ) : null}

      {postErrorMessage !== null ? (
        <Alert
          showIcon
          type="error"
          message="Не удалось опубликовать сообщение"
          description={postErrorMessage}
          action={(
            <Button size="small" onClick={clearPostError}>
              Закрыть
            </Button>
          )}
        />
      ) : null}

      <Input.TextArea
        value={draftPost}
        onChange={(event) => {
          setDraftPost(event.target.value)
        }}
        onFocus={clearPostError}
        rows={4}
        maxLength={10000}
        showCount
        placeholder="Напишите сообщение для обсуждения..."
        disabled={!canSubmitPost || isPosting}
      />

      <Space size={8}>
        <Button
          type="primary"
          loading={isPosting}
          onClick={handleSubmit}
          disabled={!canSubmitPost}
        >
          Опубликовать
        </Button>
        <Button
          onClick={() => setDraftPost('')}
          disabled={draftPost.length === 0 || isPosting}
        >
          Очистить
        </Button>
      </Space>
    </Space>
  )
}
