import { createRoot } from 'react-dom/client'
import './index.css'
import { PrivyProvider } from '@privy-io/react-auth'
import App from './App.jsx'
import { arbitrum } from 'viem/chains'

const privyAppId = import.meta.env.VITE_PRIVY_APP_ID || 'clxuy79oi00eeld70f8wvhhah';

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
      // Disable ALL injected wallet detection - WalletConnect only
      externalWallets: {
        coinbaseWallet: { enabled: false },
        metamask: { enabled: false },
        rainbow: { enabled: false },
        phantom: { enabled: false },
      },
    }}
  >
    <App />
  </PrivyProvider>
)
