// Doble de `virtual:pwa-register/react` (vite-plugin-pwa no corre en vitest).
import { vi } from 'vitest'
export const useRegisterSW = () => ({ needRefresh: [false, () => {}], offlineReady: [false, () => {}], updateServiceWorker: vi.fn() })
