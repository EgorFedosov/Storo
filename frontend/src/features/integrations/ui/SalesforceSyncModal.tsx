import { Alert, Button, Form, Input, Modal, Space, Spin, Tag, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  GetSalesforceMeResponse,
  SyncSalesforceContactRequest,
} from '../../../entities/integration/model/types.ts'
import {
  getSalesforceMe,
  syncSalesforceContact,
} from '../../../entities/integration/model/integrationsApi.ts'
import {
  resolveIntegrationFailureMessage,
  useIntegrationModalRequest,
} from '../model/useIntegrationModalRequest.ts'

type SalesforceSyncModalProps = {
  open: boolean
  onClose: () => void
}

type SalesforceMeLoadStatus = 'idle' | 'loading' | 'ready' | 'error'

type SalesforceSyncOutcome =
  | { kind: 'idle' }
  | { kind: 'synced'; sfAccountId: string | null; sfContactId: string | null; syncedAt: string | null }
  | { kind: 'failed'; errorMessage: string | null }

type SalesforceSyncFormValues = {
  companyName: string
  jobTitle: string
  phone: string
  country: string
  notes: string
}

const defaultFormValues: SalesforceSyncFormValues = {
  companyName: '',
  jobTitle: '',
  phone: '',
  country: '',
  notes: '',
}

const salesforceCompanyNameMaxLength = 200
const salesforceFieldMaxLength = 200
const salesforceNotesMaxLength = 4000

function normalizeOptionalInput(value: string): string | null {
  const normalizedValue = value.trim()
  return normalizedValue.length > 0 ? normalizedValue : null
}

function normalizeSyncStatus(value: string | null): 'synced' | 'failed' | 'unknown' {
  const normalizedValue = value?.trim().toLowerCase() ?? ''

  if (normalizedValue === 'synced') {
    return 'synced'
  }

  if (normalizedValue === 'failed') {
    return 'failed'
  }

  return 'unknown'
}

function formatDateTimeLabel(value: string | null): string | null {
  if (value === null) {
    return null
  }

  const parsedTimestamp = Date.parse(value)
  if (Number.isNaN(parsedTimestamp)) {
    return null
  }

  return new Date(parsedTimestamp).toLocaleString()
}

function resolveSalesforceTag(
  salesforceMe: GetSalesforceMeResponse | null,
  syncOutcome: SalesforceSyncOutcome,
): { label: string; color: string } {
  const normalizedLastSyncStatus = (() => {
    if (syncOutcome.kind === 'failed') {
      return 'failed'
    }

    if (syncOutcome.kind === 'synced') {
      return 'synced'
    }

    return salesforceMe?.lastSyncStatus?.trim().toLowerCase() ?? null
  })()

  const isLinked = syncOutcome.kind === 'synced'
    ? true
    : salesforceMe?.isLinked ?? false

  if (normalizedLastSyncStatus === 'failed') {
    return {
      label: 'Last sync failed',
      color: 'red',
    }
  }

  if (isLinked || normalizedLastSyncStatus === 'synced') {
    return {
      label: 'Linked',
      color: 'green',
    }
  }

  return {
    label: 'Not linked',
    color: 'default',
  }
}

function buildSyncRequestPayload(values: SalesforceSyncFormValues): SyncSalesforceContactRequest {
  return {
    companyName: values.companyName.trim(),
    jobTitle: normalizeOptionalInput(values.jobTitle),
    phone: normalizeOptionalInput(values.phone),
    country: normalizeOptionalInput(values.country),
    notes: normalizeOptionalInput(values.notes),
  }
}

export function SalesforceSyncModal({ open, onClose }: SalesforceSyncModalProps) {
  const [form] = Form.useForm<SalesforceSyncFormValues>()
  const [meLoadStatus, setMeLoadStatus] = useState<SalesforceMeLoadStatus>('idle')
  const [meErrorMessage, setMeErrorMessage] = useState<string | null>(null)
  const [salesforceMe, setSalesforceMe] = useState<GetSalesforceMeResponse | null>(null)
  const [syncOutcome, setSyncOutcome] = useState<SalesforceSyncOutcome>({ kind: 'idle' })
  const statusAbortControllerRef = useRef<AbortController | null>(null)
  const {
    status,
    isSubmitting,
    errorMessage,
    execute,
    reset,
    cancel,
  } = useIntegrationModalRequest()

  const cancelStatusRequest = useCallback(() => {
    statusAbortControllerRef.current?.abort()
    statusAbortControllerRef.current = null
  }, [])

  const loadSalesforceMeStatus = useCallback(async () => {
    cancelStatusRequest()

    const abortController = new AbortController()
    statusAbortControllerRef.current = abortController

    setMeLoadStatus('loading')
    setMeErrorMessage(null)

    const result = await getSalesforceMe(abortController.signal)
    if (abortController.signal.aborted) {
      return
    }

    if (!result.ok) {
      setMeLoadStatus('error')
      setMeErrorMessage(resolveIntegrationFailureMessage(result))
      return
    }

    setSalesforceMe(result.data)
    setMeLoadStatus('ready')
  }, [cancelStatusRequest])

  useEffect(() => () => {
    cancelStatusRequest()
  }, [cancelStatusRequest])

  const handleClose = useCallback(() => {
    cancel()
    cancelStatusRequest()
    form.resetFields()
    setSyncOutcome({ kind: 'idle' })
    setSalesforceMe(null)
    setMeErrorMessage(null)
    setMeLoadStatus('idle')
    onClose()
  }, [cancel, cancelStatusRequest, form, onClose])

  const handleAfterOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      return
    }

    void loadSalesforceMeStatus()
  }, [loadSalesforceMeStatus])

  const handleSubmit = useCallback(async (values: SalesforceSyncFormValues) => {
    setSyncOutcome({ kind: 'idle' })

    const result = await execute(
      async (signal) => syncSalesforceContact(buildSyncRequestPayload(values), signal),
    )

    if (result === null || !result.ok) {
      return
    }

    const syncStatus = normalizeSyncStatus(result.data.syncStatus)
    if (syncStatus === 'failed') {
      setSyncOutcome({
        kind: 'failed',
        errorMessage: result.data.errorMessage,
      })
    } else {
      setSyncOutcome({
        kind: 'synced',
        sfAccountId: result.data.sfAccountId,
        sfContactId: result.data.sfContactId,
        syncedAt: result.data.syncedAt,
      })
    }

    void loadSalesforceMeStatus()
  }, [execute, loadSalesforceMeStatus])

  const salesforceTag = useMemo(
    () => resolveSalesforceTag(salesforceMe, syncOutcome),
    [salesforceMe, syncOutcome],
  )

  const effectiveAccountId = syncOutcome.kind === 'synced'
    ? syncOutcome.sfAccountId
    : salesforceMe?.sfAccountId ?? null

  const effectiveContactId = syncOutcome.kind === 'synced'
    ? syncOutcome.sfContactId
    : salesforceMe?.sfContactId ?? null

  const effectiveLastSyncedAt = syncOutcome.kind === 'synced'
    ? syncOutcome.syncedAt
    : salesforceMe?.lastSyncedAt ?? null

  const effectiveLastSyncedLabel = useMemo(
    () => formatDateTimeLabel(effectiveLastSyncedAt),
    [effectiveLastSyncedAt],
  )

  return (
    <Modal
      open={open}
      title="Salesforce CRM"
      okText="Sync"
      cancelText="Cancel"
      centered
      destroyOnHidden
      afterOpenChange={handleAfterOpenChange}
      onOk={() => {
        void form.submit()
      }}
      onCancel={handleClose}
      okButtonProps={{
        loading: isSubmitting,
        disabled: isSubmitting || meLoadStatus === 'loading',
      }}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div className="salesforce-modal-status">
          <Space align="center" size={8} wrap>
            <Typography.Text type="secondary">
              Current status:
            </Typography.Text>
            {meLoadStatus === 'loading' ? <Spin size="small" /> : null}
            {meLoadStatus === 'ready' || syncOutcome.kind !== 'idle' ? (
              <Tag color={salesforceTag.color}>{salesforceTag.label}</Tag>
            ) : null}
            <Button
              size="small"
              onClick={() => {
                void loadSalesforceMeStatus()
              }}
              disabled={meLoadStatus === 'loading'}
            >
              Refresh
            </Button>
          </Space>

          {effectiveLastSyncedLabel !== null ? (
            <Typography.Text type="secondary">
              Last synced: {effectiveLastSyncedLabel}
            </Typography.Text>
          ) : null}

          {effectiveAccountId !== null || effectiveContactId !== null ? (
            <Typography.Text type="secondary">
              IDs:
              {' '}
              <Typography.Text code>{effectiveAccountId ?? '—'}</Typography.Text>
              {' / '}
              <Typography.Text code>{effectiveContactId ?? '—'}</Typography.Text>
            </Typography.Text>
          ) : null}
        </div>

        {meLoadStatus === 'error' && meErrorMessage !== null ? (
          <Alert
            showIcon
            type="error"
            message="Failed to load Salesforce status"
            description={meErrorMessage}
          />
        ) : null}

        {status === 'submitting' ? (
          <Alert
            showIcon
            type="info"
            message="Syncing..."
          />
        ) : null}

        {status === 'error' && errorMessage !== null ? (
          <Alert
            showIcon
            type="error"
            message="Failed to sync Salesforce profile"
            description={errorMessage}
          />
        ) : null}

        {syncOutcome.kind === 'synced' ? (
          <Alert
            showIcon
            type="success"
            message="Synced"
            description={`Account: ${syncOutcome.sfAccountId ?? '—'}; Contact: ${syncOutcome.sfContactId ?? '—'}`}
          />
        ) : null}

        {syncOutcome.kind === 'failed' ? (
          <Alert
            showIcon
            type="error"
            message="Status: Failed"
            description={syncOutcome.errorMessage ?? 'Salesforce returned failed status.'}
          />
        ) : null}

        <Form<SalesforceSyncFormValues>
          form={form}
          layout="vertical"
          initialValues={defaultFormValues}
          disabled={isSubmitting}
          onValuesChange={() => {
            reset()
            setSyncOutcome({ kind: 'idle' })
          }}
          onFinish={handleSubmit}
        >
          <Form.Item<SalesforceSyncFormValues>
            label="Company name"
            name="companyName"
            rules={[
              {
                required: true,
                message: 'Please provide company name.',
              },
              {
                max: salesforceCompanyNameMaxLength,
                message: `Company name must be ${String(salesforceCompanyNameMaxLength)} characters or less.`,
              },
              {
                validator: async (_, value: string | undefined) => {
                  if ((value ?? '').trim().length === 0) {
                    throw new Error('Please provide company name.')
                  }
                },
              },
            ]}
          >
            <Input
              maxLength={salesforceCompanyNameMaxLength}
              placeholder="Company LLC"
            />
          </Form.Item>

          <Form.Item<SalesforceSyncFormValues>
            label="Job title"
            name="jobTitle"
            rules={[
              {
                max: salesforceFieldMaxLength,
                message: `Job title must be ${String(salesforceFieldMaxLength)} characters or less.`,
              },
            ]}
          >
            <Input
              maxLength={salesforceFieldMaxLength}
              placeholder="Support Engineer"
            />
          </Form.Item>

          <Form.Item<SalesforceSyncFormValues>
            label="Phone"
            name="phone"
            rules={[
              {
                max: salesforceFieldMaxLength,
                message: `Phone must be ${String(salesforceFieldMaxLength)} characters or less.`,
              },
            ]}
          >
            <Input
              maxLength={salesforceFieldMaxLength}
              placeholder="+1 555 123 45 67"
            />
          </Form.Item>

          <Form.Item<SalesforceSyncFormValues>
            label="Country"
            name="country"
            rules={[
              {
                max: salesforceFieldMaxLength,
                message: `Country must be ${String(salesforceFieldMaxLength)} characters or less.`,
              },
            ]}
          >
            <Input
              maxLength={salesforceFieldMaxLength}
              placeholder="United States"
            />
          </Form.Item>

          <Form.Item<SalesforceSyncFormValues>
            label="Notes"
            name="notes"
            rules={[
              {
                max: salesforceNotesMaxLength,
                message: `Notes must be ${String(salesforceNotesMaxLength)} characters or less.`,
              },
            ]}
          >
            <Input.TextArea
              rows={3}
              maxLength={salesforceNotesMaxLength}
              showCount
              placeholder="Optional notes"
            />
          </Form.Item>
        </Form>
      </Space>
    </Modal>
  )
}
