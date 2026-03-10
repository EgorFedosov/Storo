import { SearchOutlined } from '@ant-design/icons'
import { Button, Form, Input, Select, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { navigate } from '../../../shared/lib/router/navigation.ts'
import {
  createSearchRouteFromIntent,
  parseSearchRouteState,
  searchRouteContract,
  type SearchScope,
} from '../model/searchNavigation.ts'

type GlobalSearchFormValues = {
  scope: SearchScope
  q: string
}

type GlobalSearchEntryProps = {
  pathname: string
  search: string
  disabled?: boolean
}

export function GlobalSearchEntry({ pathname, search, disabled = false }: GlobalSearchEntryProps) {
  const [form] = Form.useForm<GlobalSearchFormValues>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null)
  const submitLockRef = useRef(false)

  const routeState = useMemo(
    () => parseSearchRouteState(pathname, search),
    [pathname, search],
  )

  const scopeOptions: Array<{ value: SearchScope; label: string }> = useMemo(
    () => [
      { value: 'inventories', label: 'Инвентари' },
      { value: 'items', label: 'Предметы' },
    ],
    [],
  )

  useEffect(() => {
    form.setFieldsValue({
      scope: routeState.scope,
      q: routeState.q ?? '',
    })
  }, [form, routeState.scope, routeState.q])

  const handleSubmit = useCallback(
    async (values: GlobalSearchFormValues) => {
      if (submitLockRef.current) {
        return
      }

      submitLockRef.current = true
      setIsSubmitting(true)
      setSubmitErrorMessage(null)

      try {
        const targetPath = createSearchRouteFromIntent({
          scope: values.scope,
          q: values.q,
        })

        navigate(targetPath)
      } catch (error) {
        if (error instanceof Error && error.message.trim().length > 0) {
          setSubmitErrorMessage(error.message.trim())
        } else {
          setSubmitErrorMessage('Не удалось открыть страницу с результатами поиска.')
        }
      } finally {
        queueMicrotask(() => {
          submitLockRef.current = false
          setIsSubmitting(false)
        })
      }
    },
    [],
  )

  return (
    <div className="global-search-entry">
      <Form<GlobalSearchFormValues>
        form={form}
        initialValues={{ scope: routeState.scope, q: routeState.q ?? '' }}
        onFinish={handleSubmit}
        className="global-search-form"
      >
        <Form.Item<GlobalSearchFormValues>
          name="scope"
          className="global-search-form-item global-search-form-item-scope"
        >
          <Select<SearchScope>
            options={scopeOptions}
            disabled={disabled || isSubmitting}
            aria-label="Область поиска"
          />
        </Form.Item>

        <Form.Item<GlobalSearchFormValues>
          name="q"
          className="global-search-form-item global-search-form-item-query"
          validateFirst
          rules={[
            {
              validator: (_, value: string | undefined) => {
                const normalizedQuery = value?.trim() ?? ''
                if (normalizedQuery.length === 0) {
                  return Promise.reject(new Error('Введите поисковый запрос.'))
                }

                if (normalizedQuery.length > searchRouteContract.maxQueryLength) {
                  return Promise.reject(
                    new Error(`Запрос должен быть не длиннее ${String(searchRouteContract.maxQueryLength)} символов.`),
                  )
                }

                return Promise.resolve()
              },
            },
          ]}
        >
          <Input
            allowClear
            placeholder="Поиск по инвентарям и предметам"
            maxLength={searchRouteContract.maxQueryLength}
            disabled={disabled || isSubmitting}
            aria-label="Глобальный поисковый запрос"
          />
        </Form.Item>

        <Form.Item className="global-search-form-item global-search-form-item-submit">
          <Button
            htmlType="submit"
            type="primary"
            icon={<SearchOutlined />}
            loading={isSubmitting}
            disabled={disabled}
          >
            Найти
          </Button>
        </Form.Item>
      </Form>

      {submitErrorMessage !== null ? (
        <Typography.Text type="danger" className="global-search-error">
          {submitErrorMessage}
        </Typography.Text>
      ) : null}
    </div>
  )
}
