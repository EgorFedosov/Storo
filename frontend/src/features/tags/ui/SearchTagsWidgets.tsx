import { ReloadOutlined, TagOutlined } from '@ant-design/icons'
import { Alert, AutoComplete, Button, Card, Empty, Input, Space, Spin, Tag, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { navigate } from '../../../shared/lib/router/navigation.ts'
import {
  buildSearchRoutePath,
  searchRouteContract,
} from '../../search-navigation/model/searchNavigation.ts'
import {
  tagAutocompleteContract,
  useTagAutocompleteModel,
} from '../model/useTagAutocompleteModel.ts'
import { useTagCloudModel } from '../model/useTagCloudModel.ts'

type SearchTagsWidgetsProps = {
  activeTag: string | null
}

function normalizeTagForSearch(rawValue: string): string | null {
  const normalizedValue = rawValue.trim()

  if (normalizedValue.length === 0) {
    return null
  }

  if (normalizedValue.length > searchRouteContract.maxTagLength) {
    return null
  }

  return normalizedValue
}

function normalizeUnexpectedError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim()
  }

  return 'Не удалось перейти на страницу поиска по тегу.'
}

export function SearchTagsWidgets({ activeTag }: SearchTagsWidgetsProps) {
  const [tagInput, setTagInput] = useState(() => activeTag ?? '')
  const [navigationErrorMessage, setNavigationErrorMessage] = useState<string | null>(null)

  const {
    status: tagCloudStatus,
    items: tagCloudItems,
    errorMessage: tagCloudErrorMessage,
    reload: reloadTagCloud,
  } = useTagCloudModel()
  const {
    status: autocompleteStatus,
    items: autocompleteItems,
    errorMessage: autocompleteErrorMessage,
    requestSuggestions,
  } = useTagAutocompleteModel()

  useEffect(() => {
    const debounceHandle = window.setTimeout(() => {
      requestSuggestions(tagInput)
    }, tagAutocompleteContract.debounceMs)

    return () => {
      window.clearTimeout(debounceHandle)
    }
  }, [requestSuggestions, tagInput])

  const normalizedTagInput = tagInput.trim()
  const isTagLengthExceeded = normalizedTagInput.length > searchRouteContract.maxTagLength
  const canApplyTag = normalizedTagInput.length > 0 && !isTagLengthExceeded
  const normalizedActiveTag = activeTag === null ? null : activeTag.trim().toLowerCase()

  const autocompleteOptions = useMemo(
    () =>
      autocompleteItems.map((item) => ({
        value: item.name,
      })),
    [autocompleteItems],
  )

  const navigateToTagSearch = useCallback((rawTag: string) => {
    const normalizedTag = normalizeTagForSearch(rawTag)

    if (normalizedTag === null) {
      setNavigationErrorMessage(
        `Тег должен содержать от 1 до ${String(searchRouteContract.maxTagLength)} символов.`,
      )
      return
    }

    try {
      const targetPath = buildSearchRoutePath({
        scope: 'inventories',
        tag: normalizedTag,
        page: searchRouteContract.defaultPage,
      })

      navigate(targetPath)
      setNavigationErrorMessage(null)
    } catch (error) {
      setNavigationErrorMessage(normalizeUnexpectedError(error))
    }
  }, [])

  const handleTagApply = useCallback(() => {
    navigateToTagSearch(tagInput)
  }, [navigateToTagSearch, tagInput])

  return (
    <Card
      title="Виджеты тегов"
      extra={(
        <Button
          icon={<ReloadOutlined />}
          onClick={reloadTagCloud}
          loading={tagCloudStatus === 'loading'}
        >
          Обновить облако
        </Button>
      )}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>

        <Space.Compact block>
          <AutoComplete
            value={tagInput}
            options={autocompleteOptions}
            className="search-tags-autocomplete"
            onSelect={(value) => {
              navigateToTagSearch(value)
            }}
            onSearch={(value) => {
              setTagInput(value)
            }}
            onChange={(value) => {
              setTagInput(value)
            }}
            notFoundContent={
              autocompleteStatus === 'loading'
                ? <Spin size="small" />
                : null
            }
          >
            <Input
              allowClear
              maxLength={searchRouteContract.maxTagLength}
              prefix={<TagOutlined />}
              placeholder="Введите тег"
              onPressEnter={(event) => {
                event.preventDefault()
                handleTagApply()
              }}
            />
          </AutoComplete>

          <Button type="primary" onClick={handleTagApply} disabled={!canApplyTag}>
            Применить
          </Button>
        </Space.Compact>

        {normalizedTagInput.length > 0 && normalizedTagInput.length < tagAutocompleteContract.minPrefixLength ? (
          <Typography.Text type="secondary">
            Введите минимум {String(tagAutocompleteContract.minPrefixLength)} символа(ов), чтобы получить подсказки.
          </Typography.Text>
        ) : null}

        {isTagLengthExceeded ? (
          <Typography.Text type="danger">
            Тег должен быть не длиннее {String(searchRouteContract.maxTagLength)} символов.
          </Typography.Text>
        ) : null}

        {autocompleteErrorMessage !== null ? (
          <Alert
            showIcon
            type="warning"
            message="Не удалось получить подсказки по тегам"
            description={autocompleteErrorMessage}
          />
        ) : null}

        {navigationErrorMessage !== null ? (
          <Alert
            showIcon
            type="error"
            message="Ошибка перехода по тегу"
            description={navigationErrorMessage}
          />
        ) : null}

        {tagCloudErrorMessage !== null ? (
          <Alert
            showIcon
            type="error"
            message="Не удалось загрузить облако тегов"
            description={tagCloudErrorMessage}
            action={(
              <Button size="small" type="primary" onClick={reloadTagCloud}>
                Повторить
              </Button>
            )}
          />
        ) : null}

        {tagCloudStatus === 'loading' ? (
          <div className="search-tags-cloud-loading">
            <Spin />
          </div>
        ) : tagCloudItems.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="В облаке пока нет тегов."
          />
        ) : (
          <div className="search-tags-cloud">
            {tagCloudItems.map((item) => {
              const isActiveTag = normalizedActiveTag !== null
                && item.name.trim().toLowerCase() === normalizedActiveTag

              return (
                <Tag
                  key={item.id}
                  color={isActiveTag ? 'blue' : 'default'}
                  className="search-tags-cloud-tag"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    navigateToTagSearch(item.name)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      navigateToTagSearch(item.name)
                    }
                  }}
                >
                  {item.name} ({String(item.count)})
                </Tag>
              )
            })}
          </div>
        )}
      </Space>
    </Card>
  )
}
