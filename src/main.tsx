import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'

import './styles/globals.css'
import App from './App.tsx'

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return

    const checkForUpdates = () => {
      void registration.update()
    }

    checkForUpdates()
    setInterval(checkForUpdates, 60_000)
    window.addEventListener('focus', checkForUpdates)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdates()
    })
  },
  onRegisterError(error) {
    if (import.meta.env.DEV) {
      console.error('[pwa] service worker registration error', error)
    }
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
