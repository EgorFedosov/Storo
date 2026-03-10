import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'antd/dist/reset.css'
import { App } from './app/App.tsx'
import { AppProviders } from './app/providers/AppProviders.tsx'
import './app/styles/global.css'
import { configureApiClient } from './shared/api/httpClient.ts'
import { createAppBootstrapConfig } from './shared/config/bootstrap.ts'

const rootElement = document.getElementById('root')

if (rootElement === null) {
  throw new Error('Корневой элемент "#root" не найден.')
}

const root = createRoot(rootElement)

try {
  const bootstrapConfig = createAppBootstrapConfig(import.meta.env)
  configureApiClient({ baseUrl: bootstrapConfig.apiBaseUrl })

  root.render(
    <StrictMode>
      <AppProviders bootstrapConfig={bootstrapConfig}>
        <App />
      </AppProviders>
    </StrictMode>,
  )
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка инициализации.'

  root.render(
    <StrictMode>
      <div className="bootstrap-error" role="alert">
        <h1>Ошибка инициализации приложения</h1>
        <p>{errorMessage}</p>
      </div>
    </StrictMode>,
  )
}
