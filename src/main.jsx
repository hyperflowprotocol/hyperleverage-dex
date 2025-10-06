import { createRoot } from 'react-dom/client'
import './index.css'
import { PrivyProvider } from '@privy-io/react-auth'
import App from './App.jsx'
import { arbitrum } from 'viem/chains'

const privyAppId = import.meta.env.VITE_PRIVY_APP_ID || 'clxuy79oi00eeld70f8wvhhah';
const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

createRoot(document.getElementById('root')).render(
  <PrivyProvider
    appId={privyAppId}
    config={{
      appearance: {
        theme: 'dark',
        accentColor: '#00E3A7',
      },
      loginMethods: ['wallet'],
      embeddedWallets: {
        createOnLogin: 'off',
        noPromptOnSignature: true,
      },
      walletConnectCloudProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
      defaultChain: arbitrum,
      supportedChains: [arbitrum],
      // CRITICAL: Disable injected providers on mobile to prevent cross-origin errors
      externalWallets: isMobile ? {
        coinbaseWallet: { enabled: false },
        metamask: { enabled: false },
      } : undefined,
    }}
  >
    <App />
  </PrivyProvider>
)
