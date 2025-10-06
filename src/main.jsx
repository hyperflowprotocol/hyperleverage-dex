import { createRoot } from 'react-dom/client'
import './index.css'
import { inIframe } from './utils/inIframe.js'
import IframeNotice from './components/IframeNotice.jsx'

const isInIframe = inIframe();
console.log('🔍 Running in iframe:', isInIframe);

// If in iframe (Replit preview), show notice to open in new tab
// This prevents Privy from loading at all
if (isInIframe) {
  createRoot(document.getElementById('root')).render(<IframeNotice />);
} else {
  // Normal flow - dynamically import Privy only when NOT in iframe
  const privyAppId = import.meta.env.VITE_PRIVY_APP_ID || 'clxuy79oi00eeld70f8wvhhah';
  
  Promise.all([
    import('@privy-io/react-auth'),
    import('./App.jsx'),
    import('viem/chains')
  ]).then(([{ PrivyProvider }, { default: App }, { arbitrum }]) => {
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
          // ONLY Arbitrum - Hyperliquid operates on Arbitrum
          defaultChain: arbitrum,
          supportedChains: [arbitrum],
          // Tighten external wallet probing - only enable stable providers
          externalWallets: {
            coinbaseWallet: { enabled: true },
            metamask: { enabled: true },
            // Disable others that can cause provider conflicts in DApp browsers
            phantom: { enabled: false },
            rainbow: { enabled: false },
          },
        }}
      >
        <App />
      </PrivyProvider>
    );
  });
}
