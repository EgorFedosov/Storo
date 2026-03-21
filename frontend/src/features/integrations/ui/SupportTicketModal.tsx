import { Alert, Form, Input, Modal, Select, Space, Typography } from 'antd'
import { useCallback, useEffect } from 'react'
import {
  createFixedDropboxSupportTicketRequest,
  createSupportTicket,
} from '../../../entities/integration/model/integrationsApi.ts'
import { useIntegrationModalRequest } from '../model/useIntegrationModalRequest.ts'

type SupportTicketPriority = 'High' | 'Average' | 'Low'

type SupportTicketModalProps = {
  open: boolean
  pageLink: string
  inventoryId: string | null
  onClose: () => void
}

type SupportTicketFormValues = {
  summary: string
  priority: SupportTicketPriority
}

const supportTicketSummaryMaxLength = 4000
const priorityOptions: Array<{ label: SupportTicketPriority; value: SupportTicketPriority }> = [
  { label: 'High', value: 'High' },
  { label: 'Average', value: 'Average' },
  { label: 'Low', value: 'Low' },
]

const defaultFormValues: SupportTicketFormValues = {
  summary: '',
  priority: 'Average',
}

export function SupportTicketModal({
  open,
  pageLink,
  inventoryId,
  onClose,
}: SupportTicketModalProps) {
  const [form] = Form.useForm<SupportTicketFormValues>()
  const {
    status,
    isSubmitting,
    errorMessage,
    successMessage,
    execute,
    reset,
    cancel,
  } = useIntegrationModalRequest()

  useEffect(() => {
    if (!open) {
      return
    }

    form.setFieldsValue(defaultFormValues)
    reset()
  }, [form, open, reset])

  const handleClose = useCallback(() => {
    cancel()
    form.resetFields()
    onClose()
  }, [cancel, form, onClose])

  const handleSubmit = useCallback(async (values: SupportTicketFormValues) => {
    const normalizedSummary = values.summary.trim()
    await execute(
      async (signal) => createSupportTicket(createFixedDropboxSupportTicketRequest({
        summary: normalizedSummary,
        priority: values.priority,
        pageLink,
        inventoryId,
      }), signal),
      {
        resolveSuccessMessage: (result) => {
          if (result.data.ticketId === null) {
            return 'Ticket uploaded'
          }

          return `Ticket uploaded (ID: ${result.data.ticketId})`
        },
      },
    )
  }, [execute, inventoryId, pageLink])

  return (
    <Modal
      open={open}
      title="Create support ticket"
      okText="Upload ticket"
      cancelText="Cancel"
      centered
      destroyOnHidden
      onOk={() => {
        void form.submit()
      }}
      onCancel={handleClose}
      okButtonProps={{
        loading: isSubmitting,
        disabled: isSubmitting,
      }}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div className="support-ticket-modal-context">
          <Typography.Text type="secondary">
            Current page:
          </Typography.Text>
          <Typography.Text className="support-ticket-modal-context-value" code>
            {pageLink}
          </Typography.Text>
          {inventoryId !== null ? (
            <Typography.Text type="secondary">
              Inventory context:
              {' '}
              <Typography.Text code>#{inventoryId}</Typography.Text>
            </Typography.Text>
          ) : null}
        </div>

        {status === 'submitting' ? (
          <Alert
            showIcon
            type="info"
            message="Uploading..."
          />
        ) : null}

        {status === 'error' && errorMessage !== null ? (
          <Alert
            showIcon
            type="error"
            message="Failed to upload ticket"
            description={errorMessage}
          />
        ) : null}

        {status === 'success' ? (
          <Alert
            showIcon
            type="success"
            message={successMessage ?? 'Ticket uploaded'}
          />
        ) : null}

        <Form<SupportTicketFormValues>
          form={form}
          layout="vertical"
          initialValues={defaultFormValues}
          disabled={isSubmitting}
          onValuesChange={() => {
            reset()
          }}
          onFinish={handleSubmit}
        >
          <Form.Item<SupportTicketFormValues>
            label="Summary"
            name="summary"
            rules={[
              {
                required: true,
                message: 'Please provide a short description.',
              },
              {
                max: supportTicketSummaryMaxLength,
                message: `Summary must be ${String(supportTicketSummaryMaxLength)} characters or less.`,
              },
              {
                validator: async (_, value: string | undefined) => {
                  if ((value ?? '').trim().length === 0) {
                    throw new Error('Please provide a short description.')
                  }
                },
              },
            ]}
          >
            <Input.TextArea
              rows={4}
              maxLength={supportTicketSummaryMaxLength}
              showCount
              placeholder="Describe your issue"
            />
          </Form.Item>

          <Form.Item<SupportTicketFormValues>
            label="Priority"
            name="priority"
            rules={[
              {
                required: true,
                message: 'Please select priority.',
              },
            ]}
          >
            <Select
              options={priorityOptions}
              placeholder="Select priority"
            />
          </Form.Item>
        </Form>
      </Space>
    </Modal>
  )
}
