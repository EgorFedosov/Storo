import { createContext } from 'react'
import type { AppBootstrapConfig } from '../../shared/config/bootstrap.ts'

export const bootstrapConfigContext = createContext<AppBootstrapConfig | null>(null)
