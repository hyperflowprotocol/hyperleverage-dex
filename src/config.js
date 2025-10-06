import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { arbitrum } from '@reown/appkit/networks'
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient()

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '423de6f5958ca507cfba9cff1a0df418'

export const networks = [arbitrum]

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: false
})

export const config = wagmiAdapter.wagmiConfig

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  features: {
    analytics: false,
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#00E3A7',
    '--w3m-border-radius-master': '4px'
  }
})
