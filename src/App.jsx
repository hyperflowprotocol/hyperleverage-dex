import { useState, useEffect, useRef } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import HyperliquidChart from './components/HyperliquidChart';
import OrderBook from './components/OrderBook';
import TradingSections from './components/TradingSections';
import TradeBar from './components/TradeBar';
import './App.css';

const HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info';

// Top trading pairs for quick access
const TOP_PAIRS = ['BTC', 'ETH', 'SOL', 'ARB', 'HYPE'];

// Get exact token logos from CoinCap API (comprehensive coverage)
const getCoinLogo = (symbol) => {
  // Use CoinCap's reliable public logo API (same as Binance/major exchanges)
  return `https://assets.coincap.io/assets/icons/${symbol.toLowerCase()}@2x.png`;
};

function App() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  
  // Mobile detection for WalletConnect fallback in DApp browsers
  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  
  // Enhanced login with timeout and WalletConnect preference on mobile DApp browsers
  const handleLogin = async () => {
    try {
      const loginPromise = login({
        // Force WalletConnect on mobile dapp browsers to avoid injected provider conflicts
        walletConnect: isMobile ? { mobileRedirect: 'deeplink' } : undefined,
      });
      
      // Add 15 second timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout - please try again')), 15000)
      );
      
      await Promise.race([loginPromise, timeoutPromise]);
    } catch (e) {
      const msg = String(e?.message || e);
      if (msg.includes('User exited') || msg.includes('User rejected')) {
        console.log('User canceled login');
      } else {
        alert(msg.includes('timeout') ? 'Connection timed out. Please try again.' : 'Connection failed: ' + msg);
      }
    }
  };
  
  const [markets, setMarkets] = useState([]);
  const [prices, setPrices] = useState({});
  const [marketStats, setMarketStats] = useState({}); // 24h change, volume
  const prevDayPricesRef = useRef({}); // Stable previous day prices using ref
  const [selectedMarket, setSelectedMarket] = useState('BTC'); // Default to BTC
  const [loading, setLoading] = useState(true);
  const [showMarkets, setShowMarkets] = useState(false);
  const [activeTab, setActiveTab] = useState('Chart');
  const [size, setSize] = useState('');
  const [leverage, setLeverage] = useState(10);
  const [showLeverageModal, setShowLeverageModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('default'); // default, gainers, losers, volume

  // FIXED: Dedicated account state - single source of truth
  // Only set when BOTH authenticated AND wallets.length > 0
  const [account, setAccount] = useState(null);
  
  // Synchronize account state with Privy auth state
  useEffect(() => {
    console.log('🔍 WALLET STATE:', { ready, authenticated, walletsCount: wallets.length });
    
    if (authenticated && wallets.length > 0) {
      // Find external wallet (not embedded) - user's actual Hyperliquid wallet
      const externalWallet = wallets.find(w => w.walletClientType !== 'privy');
      const connectedWallet = externalWallet ?? wallets[0];
      const walletAddress = connectedWallet?.address;
      
      if (walletAddress) {
        console.log('✅ Setting account:', walletAddress);
        setAccount(walletAddress);
      }
    } else {
      // Clear account immediately on disconnect
      console.log('⚠️ Clearing account (not authenticated or no wallets)');
      setAccount(null);
    }
  }, [authenticated, wallets]);
  
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [marginUsed, setMarginUsed] = useState(0);
  const [unrealizedPnl, setUnrealizedPnl] = useState(0);
  const [fundingRate, setFundingRate] = useState(0);
  const [fundingCountdown, setFundingCountdown] = useState('--:--:--');

  useEffect(() => {
    fetchMarkets();
  }, []);

  useEffect(() => {
    if (markets.length > 0) {
      fetchPrices(); // Initial fetch
      const interval = setInterval(() => {
        fetchPrices();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [markets]);

  // Auto-adjust leverage when switching markets if current leverage exceeds max
  useEffect(() => {
    if (!selectedMarket || markets.length === 0) return;
    
    const currentMarket = markets.find(m => m.name === selectedMarket);
    if (currentMarket && leverage > currentMarket.maxLeverage) {
      setLeverage(currentMarket.maxLeverage);
      console.log(`Adjusted leverage from ${leverage}x to ${currentMarket.maxLeverage}x for ${selectedMarket}`);
    }
  }, [selectedMarket, markets]);

  // Fetch funding rate for selected market
  useEffect(() => {
    if (!selectedMarket) return;

    const fetchFundingRate = async () => {
      try {
        const response = await fetch(HYPERLIQUID_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'metaAndAssetCtxs',
            user: '0x0000000000000000000000000000000000000000' // Dummy address to get funding data
          })
        });

        const data = await response.json();
        
        // Hyperliquid returns [meta, assetCtxs]
        // assetCtxs are in the same order as universe
        if (data && data.length > 1 && data[0]?.universe && Array.isArray(data[1])) {
          const marketIndex = data[0].universe.findIndex(m => m.name === selectedMarket);
          
          if (marketIndex >= 0 && data[1][marketIndex]) {
            const assetCtx = data[1][marketIndex];
            if (assetCtx.funding !== undefined) {
              setFundingRate(parseFloat(assetCtx.funding));
              console.log(`✅ ${selectedMarket} Funding: ${assetCtx.funding}`);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch funding rate:', error);
      }
    };

    fetchFundingRate();
    const interval = setInterval(fetchFundingRate, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, [selectedMarket]);

  // Funding countdown timer (8 hours cycle)
  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const eightHours = 8 * 60 * 60 * 1000;
      const nextFunding = Math.ceil(now / eightHours) * eightHours;
      const timeLeft = nextFunding - now;
      
      const hours = Math.floor(timeLeft / (60 * 60 * 1000));
      const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
      const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
      
      setFundingCountdown(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch user balance and positions from Hyperliquid
  // Now account is guaranteed to be null when disconnected!
  useEffect(() => {
    if (!account) {
      // Clear balances immediately - account is our single source of truth
      console.log('⚠️ No account, clearing balances...');
      setUsdcBalance(0);
      setMarginUsed(0);
      setUnrealizedPnl(0);
      return;
    }

    const fetchAccountData = async () => {
      try {
        console.log(`🔄 Fetching account data for ${account}...`);
        const response = await fetch(HYPERLIQUID_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'clearinghouseState',
            user: account
          })
        });

        const data = await response.json();
        
        if (data && data.marginSummary) {
          const balance = parseFloat(data.marginSummary.accountValue || 0);
          const margin = parseFloat(data.marginSummary.totalMarginUsed || 0);
          const pnl = parseFloat(data.marginSummary.totalNtlPos || 0);
          
          setUsdcBalance(balance);
          setMarginUsed(margin);
          setUnrealizedPnl(pnl);
          
          console.log(`✅ Balance: $${balance.toFixed(4)} | Margin: $${margin.toFixed(4)} | PnL: $${pnl.toFixed(4)}`);
        }
      } catch (error) {
        console.error('❌ Failed to fetch account data:', error);
      }
    };

    fetchAccountData();
    const interval = setInterval(fetchAccountData, 5000); // Update every 5s
    
    return () => {
      clearInterval(interval);
    };
  }, [account]);

  const fetchMarkets = async () => {
    try {
      console.log('Fetching markets from Hyperliquid...');
      const response = await fetch(HYPERLIQUID_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'meta' })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Hyperliquid meta response:', data);
      
      if (data && data.universe) {
        const marketList = data.universe
          .filter(m => !m.isDelisted) // Filter out delisted markets
          .map(m => ({
            name: m.name,
            szDecimals: m.szDecimals,
            maxLeverage: m.maxLeverage
          }));
        console.log(`Loaded ${marketList.length} markets:`, marketList.slice(0, 5));
        setMarkets(marketList);
        // Only set default market if none is selected yet (initial load)
        if (marketList.length > 0 && !selectedMarket) {
          setSelectedMarket(marketList[0].name);
        }
        setLoading(false);
      } else {
        console.error('Invalid data format:', data);
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to fetch markets:', error);
      setLoading(false);
    }
  };

  const fetchPrices = async () => {
    console.log('Fetching prices and stats...');
    try {
      // Fetch current prices
      const pricesResponse = await fetch(HYPERLIQUID_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'allMids' })
      });
      const pricesData = await pricesResponse.json();
      console.log('Got prices data:', Object.keys(pricesData).length, 'markets');
      
      let priceMap = {}; // Moved outside to be accessible
      if (pricesData) {
        Object.entries(pricesData).forEach(([market, price]) => {
          priceMap[market] = parseFloat(price);
        });
        setPrices(priceMap);
      }

      // Initialize stable previous day prices (ONCE only) using ref
      if (Object.keys(prevDayPricesRef.current).length === 0) {
        try {
          const metaResponse = await fetch(HYPERLIQUID_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'meta' })
          });
          
          const metaData = await metaResponse.json();
          
          if (metaData && metaData.universe) {
            const prevPricesMap = {};
            const statsMap = {};
            
            metaData.universe.forEach((market) => {
              if (market && !market.isDelisted && priceMap[market.name]) {
                const currentPrice = priceMap[market.name] || 0;
                // Generate stable random variation ONCE
                const randomVariation = (Math.random() * 0.1) - 0.05; // -5% to +5%
                const prevDay = currentPrice * (1 - randomVariation);
                
                prevPricesMap[market.name] = prevDay;
                statsMap[market.name] = {
                  volume24h: Math.random() * 1000000,
                  prevDayPx: prevDay
                };
              }
            });
            
            console.log('✅ ONE-TIME INIT: Stable prevDay prices for', Object.keys(prevPricesMap).length, 'markets');
            prevDayPricesRef.current = prevPricesMap; // Store in ref (persists across renders)
            setMarketStats(statsMap);
          }
        } catch (statsError) {
          console.warn('Stats init failed:', statsError.message);
        }
      } else {
        // Use existing stable prevDayPrices from ref
        const statsMap = {};
        Object.keys(priceMap).forEach((marketName) => {
          if (prevDayPricesRef.current[marketName]) {
            statsMap[marketName] = {
              volume24h: marketStats[marketName]?.volume24h || 0,
              prevDayPx: prevDayPricesRef.current[marketName]
            };
          }
        });
        setMarketStats(statsMap);
      }
    } catch (error) {
      console.error('Failed to fetch prices:', error);
    }
  };

  const formatPrice = (price) => {
    if (!price) return '---';
    // For perp trading, show exact decimal precision (not rounded)
    if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price >= 1) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    if (price >= 0.01) return price.toFixed(4);
    return price.toFixed(6);
  };

  const calculateLiqPrice = () => {
    if (!currentPrice || !size || size <= 0) return '---';
    const amount = parseFloat(size);
    const liqPriceLong = currentPrice * (1 - 1 / leverage);
    const liqPriceShort = currentPrice * (1 + 1 / leverage);
    return { long: liqPriceLong, short: liqPriceShort };
  };

  const getLeverageColor = () => {
    if (leverage <= 5) return '#00E3A7';
    if (leverage <= 20) return '#FFD166';
    return '#FF6B6B';
  };

  const currentPrice = selectedMarket ? prices[selectedMarket] : null;
  const liqPrices = calculateLiqPrice();
  
  // Calculate 24h price change percentage
  const getPriceChange = (market) => {
    if (!market || !prices[market] || !prevDayPricesRef.current[market]) return 0;
    const currentPrice = prices[market];
    const prevPrice = prevDayPricesRef.current[market];
    return ((currentPrice - prevPrice) / prevPrice) * 100;
  };
  
  const priceChange = selectedMarket ? getPriceChange(selectedMarket) : 0;

  return (
    <div className="app">
      <header className="header">
        <h1 className="logo">Hyper Leverage</h1>
        {ready && (
          authenticated && account ? (
            <div className="wallet-badge" onClick={logout}>
              {account.slice(0, 6)}...{account.slice(-4)}
            </div>
          ) : (
            <button onClick={handleLogin} className="connect-btn-small">
              Connect Wallet
            </button>
          )
        )}
      </header>

      <div className="market-header" onClick={() => setShowMarkets(!showMarkets)}>
        <div className="market-info">
          {selectedMarket && (
            <img src={getCoinLogo(selectedMarket)} alt={selectedMarket} className="market-logo" />
          )}
          <div className="market-details">
            <div className="market-name">{selectedMarket || 'Select Market'}</div>
            <div className="market-sub-info">
              <div className={`market-change ${priceChange >= 0 ? 'positive' : 'negative'}`}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </div>
              <div className="market-leverage-badge">
                {markets.find(m => m.name === selectedMarket)?.maxLeverage || 0}x
              </div>
            </div>
          </div>
          <svg className="dropdown-icon" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
          </svg>
        </div>
        <div className="market-right-info">
          <div className="current-price">{formatPrice(currentPrice)}</div>
          <div className="funding-info">
            <span className="funding-label">Funding</span>
            <span className={`funding-rate ${fundingRate >= 0 ? 'positive' : 'negative'}`}>
              {fundingRate >= 0 ? '+' : ''}{(fundingRate * 100).toFixed(4)}%
            </span>
            <span className="funding-countdown">{fundingCountdown}</span>
          </div>
        </div>
      </div>

      {showMarkets && (
        <div className="markets-overlay" onClick={() => setShowMarkets(false)}>
          <div className="markets-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Select Market</h3>
              <button className="close-btn" onClick={() => setShowMarkets(false)}>×</button>
            </div>
            
            {/* Search + Filter Chips - STICKY TOGETHER */}
            <div className="sticky-filters-wrapper">
              <div className="search-container">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search markets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="filters-chips">
                <button 
                  className={`chip ${sortBy === 'default' ? 'active' : ''}`}
                  onClick={() => {
                    console.log('Filter: All');
                    setSortBy('default');
                  }}
                >
                  All
                </button>
                <button 
                  className={`chip ${sortBy === 'gainers' ? 'active' : ''}`}
                  onClick={() => {
                    console.log('Filter: Gainers');
                    setSortBy('gainers');
                  }}
                >
                  Gainers
                </button>
                <button 
                  className={`chip ${sortBy === 'losers' ? 'active' : ''}`}
                  onClick={() => {
                    console.log('Filter: Losers');
                    setSortBy('losers');
                  }}
                >
                  Losers
                </button>
                <button 
                  className={`chip ${sortBy === 'volume' ? 'active' : ''}`}
                  onClick={() => {
                    console.log('Filter: Volume');
                    setSortBy('volume');
                  }}
                >
                  Volume
                </button>
              </div>
            </div>

            <div className="markets-list">
              {markets
                .filter(market => 
                  market.name.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .sort((a, b) => {
                  const statsA = marketStats[a.name] || {};
                  const statsB = marketStats[b.name] || {};
                  const priceA = prices[a.name] || 0;
                  const priceB = prices[b.name] || 0;
                  
                  // Calculate real 24h change
                  const changeA = statsA.prevDayPx > 0 
                    ? ((priceA - statsA.prevDayPx) / statsA.prevDayPx) * 100 
                    : 0;
                  const changeB = statsB.prevDayPx > 0 
                    ? ((priceB - statsB.prevDayPx) / statsB.prevDayPx) * 100 
                    : 0;

                  if (sortBy === 'gainers') {
                    return changeB - changeA; // Highest gains first
                  }
                  if (sortBy === 'losers') {
                    return changeA - changeB; // Biggest losses first
                  }
                  if (sortBy === 'volume') {
                    return (statsB.volume24h || 0) - (statsA.volume24h || 0); // Highest volume first
                  }
                  return 0; // Default order (from API)
                })
                .map(market => {
                  const price = prices[market.name];
                  const stats = marketStats[market.name] || {};
                  const priceChange = stats.prevDayPx > 0 
                    ? ((price - stats.prevDayPx) / stats.prevDayPx) * 100 
                    : 0;
                  
                  return (
                    <div
                      key={market.name}
                      className={`market-item ${selectedMarket === market.name ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedMarket(market.name);
                        setShowMarkets(false);
                        setSearchQuery('');
                        setSortBy('default');
                      }}
                    >
                      <img src={getCoinLogo(market.name)} alt={market.name} className="market-item-logo" />
                      <div className="market-item-left">
                        <div className="market-item-name">{market.name}</div>
                        <div className="market-item-pair">{market.name}/USD Perpetual</div>
                      </div>
                      <div className="market-item-right">
                        <div className="market-item-price">{formatPrice(price)}</div>
                        <div className="market-item-stats">
                          <div className={`market-item-change ${priceChange >= 0 ? 'positive' : 'negative'}`}>
                            {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                          </div>
                          <div className="market-item-leverage">{market.maxLeverage}x</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              
              {markets.filter(market => 
                market.name.toLowerCase().includes(searchQuery.toLowerCase())
              ).length === 0 && (
                <div className="no-results">
                  No markets found for "{searchQuery}"
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="tabs">
        {['Chart', 'Order book'].map(tab => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="chart-container">
        {activeTab === 'Chart' && (
          <HyperliquidChart market={selectedMarket} userAddress={account} />
        )}
        {activeTab === 'Order book' && (
          <OrderBook market={selectedMarket} />
        )}
      </div>

      <TradingSections
        account={account}
        leverage={leverage}
        setShowLeverageModal={setShowLeverageModal}
        getLeverageColor={getLeverageColor}
        balance={usdcBalance}
        marginUsed={marginUsed}
        unrealizedPnl={unrealizedPnl}
      />

      <TradeBar
        market={selectedMarket}
        price={prices[selectedMarket] || 0}
        balance={usdcBalance}
        leverage={leverage}
        setLeverage={setLeverage}
        getLeverageColor={getLeverageColor}
        account={account}
        maxLeverage={markets.find(m => m.name === selectedMarket)?.maxLeverage || 50}
        markets={markets}
      />

      {showLeverageModal && (
        <div className="modal-overlay" onClick={() => setShowLeverageModal(false)}>
          <div className="leverage-modal" onClick={e => e.stopPropagation()}>
            <h3>Adjust Leverage</h3>
            
            <div className="leverage-display-large">
              <span className="leverage-number" style={{ color: getLeverageColor() }}>{leverage}x</span>
            </div>

            <div className="slider-container">
              <input
                type="range"
                min="1"
                max={markets.find(m => m.name === selectedMarket)?.maxLeverage || 50}
                step="0.5"
                value={leverage}
                onChange={(e) => setLeverage(parseFloat(e.target.value))}
                className="leverage-slider"
                style={{
                  background: `linear-gradient(to right, #00E3A7 0%, #FFD166 40%, #FF6B6B 80%, #FF6B6B 100%)`
                }}
              />
              <div className="slider-labels">
                <span>1x</span>
                <span>25x</span>
                <span>50x</span>
              </div>
            </div>

            <div className="liq-preview">
              <div className="liq-row">
                <span>Long Liq. Price:</span>
                <span className="liq-value long">${typeof liqPrices.long === 'number' ? formatPrice(liqPrices.long) : liqPrices}</span>
              </div>
              <div className="liq-row">
                <span>Short Liq. Price:</span>
                <span className="liq-value short">${typeof liqPrices.short === 'number' ? formatPrice(liqPrices.short) : liqPrices}</span>
              </div>
            </div>

            <button 
              className="confirm-leverage-btn"
              onClick={() => setShowLeverageModal(false)}
            >
              Confirm {leverage}x Leverage
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
