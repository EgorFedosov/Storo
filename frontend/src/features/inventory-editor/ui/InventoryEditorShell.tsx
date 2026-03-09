import { Card, Empty, Space, Table, Tabs, Tag, Typography } from 'antd'
import type { TableProps } from 'antd'
import { useMemo } from 'react'
import type { InventoryEditor } from '../../../entities/inventory/model/inventoryEditorTypes.ts'
import type { InventoryEditorTabKey, InventoryEditorTabState } from '../model/useInventoryEditorModel.ts'

type InventoryEditorShellProps = {
  editor: InventoryEditor
  etag: string | null
  activeTabKey: InventoryEditorTabKey
  tabStates: ReadonlyArray<InventoryEditorTabState>
  onTabChange: (nextTabKey: InventoryEditorTabKey) => void
}

type PropertyValueRow = {
  key: string
  property: string
  value: string
}

type WriterRow = {
  key: string
  id: string
  displayName: string
  userName: string
  email: string
  isBlocked: boolean
}

function isInventoryEditorTabKey(value: string): value is InventoryEditorTabKey {
  return (
    value === 'settings'
    || value === 'tags'
    || value === 'access'
    || value === 'customFields'
    || value === 'customIdTemplate'
  )
}

function renderSettingsTab(editor: InventoryEditor) {
  const rows: PropertyValueRow[] = [
    { key: 'title', property: 'Title', value: editor.settings.title },
    { key: 'description', property: 'Description', value: editor.settings.descriptionMarkdown || '(empty)' },
    { key: 'category', property: 'Category', value: editor.settings.category.name },
    { key: 'imageUrl', property: 'Image URL', value: editor.settings.imageUrl ?? '(none)' },
  ]

  const columns: NonNullable<TableProps<PropertyValueRow>['columns']> = [
    {
      title: 'Property',
      dataIndex: 'property',
      key: 'property',
      width: 220,
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
    },
  ]

  return (
    <Table<PropertyValueRow>
      rowKey="key"
      columns={columns}
      dataSource={rows}
      pagination={false}
      size="middle"
    />
  )
}

function renderTagsTab(editor: InventoryEditor) {
  const columns: NonNullable<TableProps<InventoryEditor['tags'][number]>['columns']> = [
    {
      title: 'Tag',
      dataIndex: 'name',
      key: 'name',
      render: (value: string) => <Tag>{value}</Tag>,
    },
    {
      title: 'Tag ID',
      dataIndex: 'id',
      key: 'id',
      width: 180,
    },
  ]

  return (
    <Table<InventoryEditor['tags'][number]>
      rowKey="id"
      columns={columns}
      dataSource={[...editor.tags]}
      pagination={false}
      size="middle"
      locale={{
        emptyText: (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No tags configured for this inventory."
          />
        ),
      }}
    />
  )
}

function renderAccessTab(editor: InventoryEditor) {
  const rows: WriterRow[] = editor.access.writers.map((writer) => ({
    key: writer.id,
    id: writer.id,
    displayName: writer.displayName,
    userName: writer.userName,
    email: writer.email,
    isBlocked: writer.isBlocked,
  }))

  const columns: NonNullable<TableProps<WriterRow>['columns']> = [
    {
      title: 'Display Name',
      dataIndex: 'displayName',
      key: 'displayName',
    },
    {
      title: 'User Name',
      dataIndex: 'userName',
      key: 'userName',
      width: 220,
      render: (value: string) => `@${value}`,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 280,
    },
    {
      title: 'Status',
      dataIndex: 'isBlocked',
      key: 'isBlocked',
      width: 120,
      render: (isBlocked: boolean) => (
        <Tag color={isBlocked ? 'red' : 'green'}>
          {isBlocked ? 'Blocked' : 'Active'}
        </Tag>
      ),
    },
  ]

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Typography.Text>
        Access mode:{' '}
        <Tag color={editor.access.mode === 'public' ? 'green' : 'gold'}>
          {editor.access.mode === 'public' ? 'Public' : 'Restricted'}
        </Tag>
      </Typography.Text>

      <Table<WriterRow>
        rowKey="key"
        columns={columns}
        dataSource={rows}
        pagination={false}
        size="middle"
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No explicit writers configured."
            />
          ),
        }}
      />
    </Space>
  )
}

function renderCustomFieldsTab(editor: InventoryEditor) {
  const columns: NonNullable<TableProps<InventoryEditor['customFields'][number]>['columns']> = [
    {
      title: 'Field',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Type',
      dataIndex: 'fieldType',
      key: 'fieldType',
      width: 160,
      render: (fieldType: string) => <Tag>{fieldType}</Tag>,
    },
    {
      title: 'Show In Table',
      dataIndex: 'showInTable',
      key: 'showInTable',
      width: 140,
      render: (showInTable: boolean) => (
        <Tag color={showInTable ? 'green' : 'default'}>
          {showInTable ? 'Yes' : 'No'}
        </Tag>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (description: string) => (description.trim().length > 0 ? description : '(empty)'),
    },
  ]

  return (
    <Table<InventoryEditor['customFields'][number]>
      rowKey="id"
      columns={columns}
      dataSource={[...editor.customFields]}
      pagination={false}
      size="middle"
      locale={{
        emptyText: (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Custom fields are not configured yet."
          />
        ),
      }}
    />
  )
}

function renderCustomIdTemplateTab(editor: InventoryEditor) {
  const partColumns: NonNullable<TableProps<InventoryEditor['customIdTemplate']['parts'][number]>['columns']> = [
    {
      title: 'Part Type',
      dataIndex: 'partType',
      key: 'partType',
      width: 180,
      render: (partType: string) => <Tag>{partType}</Tag>,
    },
    {
      title: 'Fixed Text',
      dataIndex: 'fixedText',
      key: 'fixedText',
      width: 260,
      render: (fixedText: string | null) => fixedText ?? '(none)',
    },
    {
      title: 'Format Pattern',
      dataIndex: 'formatPattern',
      key: 'formatPattern',
      width: 220,
      render: (formatPattern: string | null) => formatPattern ?? '(none)',
    },
    {
      title: 'Part ID',
      dataIndex: 'id',
      key: 'id',
      width: 140,
    },
  ]

  const warningRows = editor.customIdTemplate.preview.warnings.map((warning, index) => ({
    key: `${warning}-${String(index)}`,
    warning,
  }))

  const warningColumns: NonNullable<TableProps<{ key: string; warning: string }>['columns']> = [
    {
      title: 'Preview Warning',
      dataIndex: 'warning',
      key: 'warning',
      render: (warning: string) => <Tag color="orange">{warning}</Tag>,
    },
  ]

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Space size={8} wrap>
        <Tag color={editor.customIdTemplate.isEnabled ? 'green' : 'default'}>
          {editor.customIdTemplate.isEnabled ? 'Template Enabled' : 'Template Disabled'}
        </Tag>
        <Tag>Preview: {editor.customIdTemplate.preview.sampleCustomId || '(empty)'}</Tag>
        <Tag>
          Regex: {editor.customIdTemplate.derivedValidationRegex ?? '(none)'}
        </Tag>
      </Space>

      <Table<InventoryEditor['customIdTemplate']['parts'][number]>
        rowKey="id"
        columns={partColumns}
        dataSource={[...editor.customIdTemplate.parts]}
        pagination={false}
        size="middle"
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Template parts are not configured."
            />
          ),
        }}
      />

      <Table<{ key: string; warning: string }>
        rowKey="key"
        columns={warningColumns}
        dataSource={warningRows}
        pagination={false}
        size="middle"
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No preview warnings."
            />
          ),
        }}
      />
    </Space>
  )
}

export function InventoryEditorShell({
  editor,
  etag,
  activeTabKey,
  tabStates,
  onTabChange,
}: InventoryEditorShellProps) {
  const tabs = useMemo(
    () =>
      tabStates.map((tab) => ({
        key: tab.key,
        label: tab.label,
        disabled: tab.disabled,
        children:
          tab.key === 'settings'
            ? renderSettingsTab(editor)
            : tab.key === 'tags'
              ? renderTagsTab(editor)
              : tab.key === 'access'
                ? renderAccessTab(editor)
                : tab.key === 'customFields'
                  ? renderCustomFieldsTab(editor)
                  : renderCustomIdTemplateTab(editor),
      })),
    [editor, tabStates],
  )

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 0 }}>
            {editor.settings.title} Editor
          </Typography.Title>
          <Space size={8} wrap>
            <Tag color="blue">Inventory #{editor.id}</Tag>
            <Tag>Version: {String(editor.version)}</Tag>
            <Tag>ETag: {etag ?? '(missing)'}</Tag>
          </Space>
          <Typography.Text type="secondary">
            Editor aggregate loaded from `GET /api/v1/inventories/:inventoryId/edit`.
          </Typography.Text>
        </Space>
      </Card>

      <Card>
        <Tabs
          activeKey={activeTabKey}
          onChange={(nextTabKey) => {
            if (isInventoryEditorTabKey(nextTabKey)) {
              onTabChange(nextTabKey)
            }
          }}
          items={tabs}
        />
      </Card>
    </Space>
  )
}
