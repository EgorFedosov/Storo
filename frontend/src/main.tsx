import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App.tsx'
import { AppProviders } from './app/providers/AppProviders.tsx'
import './app/styles/global.css'
import { createAppBootstrapConfig } from './shared/config/bootstrap.ts'

const rootElement = document.getElementById('root')

if (rootElement === null) {
  throw new Error('Root element "#root" was not found.')
}

const root = createRoot(rootElement)

try {
  const bootstrapConfig = createAppBootstrapConfig(import.meta.env)

  root.render(
    <StrictMode>
      <AppProviders bootstrapConfig={bootstrapConfig}>
        <App />
      </AppProviders>
    </StrictMode>,
  )
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown bootstrap error.'

  root.render(
    <StrictMode>
      <div className="bootstrap-error" role="alert">
        <h1>Application bootstrap failed</h1>
        <p>{errorMessage}</p>
      </div>
    </StrictMode>,
  )
}
