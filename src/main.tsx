import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { OperationalStoreProvider } from './state/OperationalStore.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <OperationalStoreProvider>
        <App />
      </OperationalStoreProvider>
    </ErrorBoundary>
  </StrictMode>,
)

