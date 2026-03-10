import { ReloadOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Result, Space, Spin, Typography } from 'antd'
import { useCallback, useMemo } from 'react'
import { useItemLifecycleModel } from '../../../features/item-lifecycle/model/useItemLifecycleModel.ts'
import { ItemLifecycleView } from '../../../features/item-lifecycle/ui/ItemLifecycleView.tsx'
import { navigate, useLocationSnapshot } from '../../../shared/lib/router/navigation.ts'

function parseItemIdFromPath(pathname: string): string | null {
  const normalizedPath = pathname.trim().replace(/\/+$/, '')
  const match = /^\/items?\/([1-9]\d*)$/i.exec(normalizedPath)
  if (match === null) {
    return null
  }

  return match[1]
}

export function ItemPage() {
  const locationSnapshot = useLocationSnapshot()
  const itemId = useMemo(
    () => parseItemIdFromPath(locationSnapshot.pathname),
    [locationSnapshot.pathname],
  )

  const {
    status,
    item,
    etag,
    errorMessage,
    errorStatus,
    isAuthenticated,
    isBlocked,
    isUpdating,
    isDeleting,
    isLikeUpdating,
    updateErrorMessage,
    updateFieldErrors,
    deleteErrorMessage,
    likeErrorMessage,
    concurrencyProblem,
    retryLoad,
    reloadLatest,
    clearMutationErrors,
    clearConcurrencyProblem,
    submitUpdate,
    submitDelete,
    submitLike,
  } = useItemLifecycleModel(itemId)

  const handleDelete = useCallback(async () => {
    const result = await submitDelete()
    if (result.ok && result.redirectPath !== null) {
      navigate(result.redirectPath)
    }
  }, [submitDelete])

  if (status === 'loading' || status === 'idle') {
    return (
      <Card>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 0 }}>
            Item
          </Typography.Title>
          <Typography.Text type="secondary">
            Loading item details...
          </Typography.Text>
          <div className="inventory-details-loader" role="status" aria-live="polite">
            <Spin size="large" />
          </div>
        </Space>
      </Card>
    )
  }

  if (status === 'error') {
    if (errorStatus === 404) {
      return (
        <Result
          status="404"
          title="Item not found"
          subTitle="Requested item does not exist or was removed."
          extra={(
            <Space wrap>
              <Button type="primary" icon={<ReloadOutlined />} onClick={retryLoad}>
                Retry
              </Button>
              <Button onClick={() => navigate('/home')}>
                Go to Home
              </Button>
            </Space>
          )}
        />
      )
    }

    return (
      <Alert
        showIcon
        type="error"
        message="Failed to load item details"
        description={errorMessage ?? 'Item details request failed.'}
        action={(
          <Button type="primary" size="small" icon={<ReloadOutlined />} onClick={retryLoad}>
            Retry
          </Button>
        )}
      />
    )
  }

  if (item === null) {
    return (
      <Result
        status="error"
        title="Item details are unavailable"
        subTitle="API returned an unexpected response."
        extra={(
          <Button type="primary" icon={<ReloadOutlined />} onClick={retryLoad}>
            Retry
          </Button>
        )}
      />
    )
  }

  return (
    <ItemLifecycleView
      item={item}
      etag={etag}
      isAuthenticated={isAuthenticated}
      isBlocked={isBlocked}
      isUpdating={isUpdating}
      isDeleting={isDeleting}
      isLikeUpdating={isLikeUpdating}
      updateErrorMessage={updateErrorMessage}
      updateFieldErrors={updateFieldErrors}
      deleteErrorMessage={deleteErrorMessage}
      likeErrorMessage={likeErrorMessage}
      concurrencyProblem={concurrencyProblem}
      canLike={item.permissions.canLike}
      onReloadLatest={reloadLatest}
      onClearConcurrencyProblem={clearConcurrencyProblem}
      onClearMutationErrors={clearMutationErrors}
      onSubmitUpdate={submitUpdate}
      onDelete={handleDelete}
      onSubmitLike={submitLike}
    />
  )
}

