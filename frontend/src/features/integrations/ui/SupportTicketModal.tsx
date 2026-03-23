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
const priorityOptions: Array<{ label: string; value: SupportTicketPriority }> = [
  { label: 'Высокий', value: 'High' },
  { label: 'Средний', value: 'Average' },
  { label: 'Низкий', value: 'Low' },
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
            return 'Сообщение отправлено'
          }

          return `Сообщение отправлено (ID: ${result.data.ticketId})`
        },
      },
    )
  }, [execute, inventoryId, pageLink])

  return (
    <Modal
      open={open}
      title="Сообщить о проблеме"
      okText="Отправить сообщение"
      cancelText="Отмена"
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
            Текущая страница:
          </Typography.Text>
          <Typography.Text className="support-ticket-modal-context-value" code>
            {pageLink}
          </Typography.Text>
          {inventoryId !== null ? (
            <Typography.Text type="secondary">
              Контекст инвентаря:
              {' '}
              <Typography.Text code>#{inventoryId}</Typography.Text>
            </Typography.Text>
          ) : null}
        </div>

        {status === 'submitting' ? (
          <Alert
            showIcon
            type="info"
            message="Отправка..."
          />
        ) : null}

        {status === 'error' && errorMessage !== null ? (
          <Alert
            showIcon
            type="error"
            message="Не удалось отправить"
            description={errorMessage}
          />
        ) : null}

        {status === 'success' ? (
          <Alert
            showIcon
            type="success"
            message={successMessage ?? 'Сообщение отправлено'}
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
            label="Описание проблемы"
            name="summary"
            rules={[
              {
                required: true,
                message: 'Опишите проблему.',
              },
              {
                max: supportTicketSummaryMaxLength,
                message: `Описание должно быть не длиннее ${String(supportTicketSummaryMaxLength)} символов.`,
              },
              {
                validator: async (_, value: string | undefined) => {
                  if ((value ?? '').trim().length === 0) {
                    throw new Error('Опишите проблему.')
                  }
                },
              },
            ]}
          >
            <Input.TextArea
              rows={4}
              maxLength={supportTicketSummaryMaxLength}
              showCount
              placeholder="Коротко опишите проблему"
            />
          </Form.Item>

          <Form.Item<SupportTicketFormValues>
            label="Приоритет"
            name="priority"
            rules={[
              {
                required: true,
                message: 'Выберите приоритет.',
              },
            ]}
          >
            <Select
              options={priorityOptions}
              placeholder="Выберите приоритет"
            />
          </Form.Item>
        </Form>
      </Space>
    </Modal>
  )
}
