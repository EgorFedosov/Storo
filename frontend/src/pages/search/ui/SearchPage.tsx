import { Alert, Card, Descriptions, Space, Tag } from 'antd'
import { useMemo } from 'react'
import { parseSearchRouteState } from '../../../features/search-navigation/model/searchNavigation.ts'
import { useLocationSnapshot } from '../../../shared/lib/router/navigation.ts'
import { PagePrototype } from '../../../shared/ui/PagePrototype.tsx'

const checklist = [
  'Header search should trigger /api/v1/search/inventories or /api/v1/search/items.',
  'Keep table-first results with pagination and sort.',
  'Preserve query params in URL for shareable filters.',
] as const

export function SearchPage() {
  const locationSnapshot = useLocationSnapshot()
  const routeState = useMemo(
    () => parseSearchRouteState(locationSnapshot.pathname, locationSnapshot.search),
    [locationSnapshot.pathname, locationSnapshot.search],
  )
  const validationErrors = Object.entries(routeState.errors)

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card title="Search Route State">
        <Descriptions
          column={2}
          size="small"
          items={[
            {
              key: 'scope',
              label: 'Scope',
              children: (
                <Tag color="blue">
                  {routeState.scope}
                </Tag>
              ),
            },
            {
              key: 'q',
              label: 'q',
              children: routeState.q ?? 'null',
            },
            {
              key: 'tag',
              label: 'tag',
              children: routeState.tag ?? 'null',
            },
            {
              key: 'page',
              label: 'page',
              children: String(routeState.page),
            },
            {
              key: 'pageSize',
              label: 'pageSize',
              children: String(routeState.pageSize),
            },
            {
              key: 'sort',
              label: 'sort',
              children: routeState.sort ?? 'null',
            },
          ]}
        />

        {validationErrors.length > 0 ? (
          <Alert
            showIcon
            type="warning"
            message="Invalid search query params"
            description={validationErrors.map(([field, message]) => `${field}: ${message}`).join(' | ')}
            style={{ marginTop: 12 }}
          />
        ) : null}
      </Card>

      <PagePrototype
        title="Search"
        description="Shared search page layout for inventories and items."
        checklist={checklist}
      />
    </Space>
  )
}
