import { Alert, Button, Card, Empty, Segmented, Select, Space, Table, Tag, Typography } from 'antd'
import type { TableProps } from 'antd'
import dayjs from 'dayjs'
import { useCallback, useMemo } from 'react'
import type {
  SearchItemSummary,
  SearchItemsSortDirection,
  SearchItemsSortField,
} from '../../../entities/search-item/model/searchItemsApi.ts'
import {
  buildSearchRoutePath,
  parseSearchRouteState,
} from '../../../features/search-navigation/model/searchNavigation.ts'
import {
  SearchInventoriesScreen,
  type SearchInventoriesRoutePatch,
} from '../../../features/search-inventories/ui/SearchInventoriesScreen.tsx'
import { SearchTagsWidgets } from '../../../features/tags/ui/SearchTagsWidgets.tsx'
import { navigate, useLocationSnapshot } from '../../../shared/lib/router/navigation.ts'
import {
  searchItemsSortDirectionOptions,
  searchItemsSortFieldOptions,
  useSearchItemsPageModel,
} from '../model/useSearchItemsPageModel.ts'

export function SearchPage() {
  const locationSnapshot = useLocationSnapshot()
  const routeState = useMemo(
    () => parseSearchRouteState(locationSnapshot.pathname, locationSnapshot.search),
    [locationSnapshot.pathname, locationSnapshot.search],
  )

  const handleApplyInventoryRoute = useCallback(
    (routePatch: SearchInventoriesRoutePatch) => {
      const targetPath = buildSearchRoutePath({
        scope: 'inventories',
        q: routePatch.q === undefined ? routeState.q : routePatch.q,
        tag: routePatch.tag === undefined ? routeState.tag : routePatch.tag,
        page: routePatch.page === undefined ? routeState.page : routePatch.page,
        pageSize: routePatch.pageSize === undefined ? routeState.pageSize : routePatch.pageSize,
        sort: routePatch.sort === undefined ? routeState.sort : routePatch.sort,
      })

      navigate(targetPath)
    },
    [routeState.page, routeState.pageSize, routeState.q, routeState.sort, routeState.tag],
  )

  if (routeState.scope === 'items') {
    return <SearchItemsResults />
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <SearchInventoriesScreen
        routeState={routeState}
        onApplyRoute={handleApplyInventoryRoute}
      />

      <SearchTagsWidgets key={routeState.tag ?? '__no_tag__'} activeTag={routeState.tag} />
    </Space>
  )
}

function formatDateTime(value: string): string {
  const parsedDate = dayjs(value)
  return parsedDate.isValid() ? parsedDate.format('DD.MM.YYYY HH:mm') : value
}

function resolveSortFieldLabel(field: SearchItemsSortField): string {
  if (field === 'relevance') {
    return 'Релевантность'
  }

  if (field === 'updatedAt') {
    return 'Дата обновления'
  }

  if (field === 'createdAt') {
    return 'Дата создания'
  }

  return 'Пользовательский ID'
}

function resolveSortDirectionLabel(direction: SearchItemsSortDirection): string {
  return direction === 'desc'
    ? 'По убыванию'
    : 'По возрастанию'
}

function SearchItemsResults() {
  const {
    routeState,
    validationErrors,
    sort,
    items,
    totalCount,
    isLoading,
    errorMessage,
    handlePageChange,
    handleSortFieldChange,
    handleSortDirectionChange,
    retry,
  } = useSearchItemsPageModel()

  const sortFieldOptions = useMemo(
    () => searchItemsSortFieldOptions.map((option) => ({
      value: option.value,
      label: resolveSortFieldLabel(option.value),
    })),
    [],
  )

  const sortDirectionOptions = useMemo(
    () => searchItemsSortDirectionOptions.map((option) => ({
      value: option.value,
      label: resolveSortDirectionLabel(option.value),
    })),
    [],
  )

  const columns = useMemo<NonNullable<TableProps<SearchItemSummary>['columns']>>(
    () => [
      {
        title: 'Пользовательский ID',
        dataIndex: 'customId',
        key: 'customId',
        render: (_, record) => (
          <Typography.Link onClick={() => navigate(`/items/${record.id}`)}>
            {record.customId}
          </Typography.Link>
        ),
      },
      {
        title: 'Инвентарь',
        dataIndex: ['inventory', 'title'],
        key: 'inventory',
        render: (_, record) => (
          <Typography.Link onClick={() => navigate(`/inventories/${record.inventory.id}`)}>
            {record.inventory.title}
          </Typography.Link>
        ),
      },
      {
        title: 'Создан',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 180,
        render: (value: string) => formatDateTime(value),
      },
      {
        title: 'Обновлен',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        width: 180,
        render: (value: string) => formatDateTime(value),
      },
    ],
    [],
  )

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          Поиск предметов
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          Ищите предметы по тексту и просматривайте результаты в табличном формате.
        </Typography.Paragraph>
        <Space size={8} wrap>
          <Tag color="blue">
            q: {routeState.q ?? 'не задан'}
          </Tag>
          <Tag color="geekblue">
            страница: {String(routeState.page)}
          </Tag>
          <Tag color="geekblue">
            размер: {String(routeState.pageSize)}
          </Tag>
          <Tag color="green">
            всего: {String(totalCount)}
          </Tag>
        </Space>
      </Card>

      {validationErrors.length > 0 ? (
        <Alert
          showIcon
          type="warning"
          message="Некорректные параметры поиска"
          description={validationErrors.map(([field, message]) => `${field}: ${message}`).join(' | ')}
        />
      ) : null}

      {errorMessage !== null ? (
        <Alert
          showIcon
          type="error"
          message="Не удалось загрузить /search/items"
          description={errorMessage}
          action={(
            <Button type="primary" size="small" onClick={retry}>
              Повторить
            </Button>
          )}
        />
      ) : null}

      <Card
        title="Таблица предметов"
        extra={(
          <Space>
            <Select<SearchItemsSortField>
              value={sort.field}
              options={sortFieldOptions}
              onChange={handleSortFieldChange}
              disabled={routeState.q === null || isLoading}
              style={{ width: 170 }}
              aria-label="Поле сортировки"
            />
            <Segmented<SearchItemsSortDirection>
              value={sort.direction}
              options={sortDirectionOptions}
              onChange={(nextDirection) => handleSortDirectionChange(nextDirection)}
              disabled={routeState.q === null || isLoading}
            />
          </Space>
        )}
      >
        <Table<SearchItemSummary>
          rowKey="id"
          columns={columns}
          dataSource={[...items]}
          loading={isLoading}
          onChange={(paginationState) => {
            handlePageChange(
              paginationState.current ?? routeState.page,
              paginationState.pageSize ?? routeState.pageSize,
            )
          }}
          pagination={{
            current: routeState.page,
            pageSize: routeState.pageSize,
            total: totalCount,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (count, range) => `${String(range[0])}-${String(range[1])} из ${String(count)}`,
          }}
          locale={{
            emptyText: routeState.q === null
              ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Введите запрос в шапке, чтобы загрузить результаты поиска предметов."
                />
              )
              : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="По текущему запросу ничего не найдено."
                />
              ),
          }}
          size="middle"
        />
      </Card>
    </Space>
  )
}
