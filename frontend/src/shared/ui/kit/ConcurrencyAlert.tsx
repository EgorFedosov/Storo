import { Alert, Button } from 'antd'
import type { CSSProperties } from 'react'
import { describeConcurrencyProblem, type ConcurrencyProblem } from '../../api/concurrency.ts'

type ConcurrencyAlertProps = {
  problem: ConcurrencyProblem | null
  onReload?: () => void
  onClose?: () => void
  style?: CSSProperties
}

export function ConcurrencyAlert({ problem, onReload, onClose, style }: ConcurrencyAlertProps) {
  if (problem === null) {
    return null
  }

  const ui = describeConcurrencyProblem(problem)

  return (
    <Alert
      showIcon
      type="warning"
      message={ui.title}
      description={ui.description}
      action={
        ui.requiresReload && onReload !== undefined ? (
          <Button size="small" onClick={onReload}>
            Reload
          </Button>
        ) : undefined
      }
      closable={onClose !== undefined}
      onClose={onClose}
      style={style}
    />
  )
}
