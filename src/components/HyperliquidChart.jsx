import { useEffect, useRef, useState } from 'react';

const HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info';

export default function HyperliquidChart({ market, userAddress }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const [timeframe, setTimeframe] = useState('15m');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartReady, setChartReady] = useState(false);
  
  const entryLineRef = useRef(null);
  const tpLineRef = useRef(null);
  const slLineRef = useRef(null);
  const [showTPSL, setShowTPSL] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [trades, setTrades] = useState([]);
  const currentMarkersRef = useRef([]);
  const [showSettings, setShowSettings] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Initialize chart once LightweightCharts is available
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const initChart = () => {
      if (!window.LightweightCharts) {
        console.log('Waiting for lightweight-charts to load...');
        setTimeout(initChart, 100); // Poll every 100ms
        return;
      }

      try {
        const chart = window.LightweightCharts.createChart(chartContainerRef.current, {
          layout: {
            background: { color: '#0B0D10' },
            textColor: '#A6B0BD',
          },
          grid: {
            vertLines: { color: 'rgba(255,255,255,0.04)' },
            horzLines: { color: 'rgba(255,255,255,0.04)' },
          },
          rightPriceScale: {
            borderColor: 'rgba(255,255,255,0.1)',
          },
          timeScale: {
            borderColor: 'rgba(255,255,255,0.1)',
            timeVisible: true,
            secondsVisible: false,
          },
          width: chartContainerRef.current.clientWidth,
          height: 300,
        });

        const candleSeries = chart.addCandlestickSeries({
          upColor: '#00E3A7',
          downColor: '#FF6B6B',
          wickUpColor: '#00E3A7',
          wickDownColor: '#FF6B6B',
          borderVisible: false,
        });

        chartRef.current = chart;
        candleSeriesRef.current = candleSeries;
        setChartReady(true);
        console.log('Chart initialized successfully!');

        // Handle resize
        const handleResize = () => {
          if (chartContainerRef.current && chartRef.current) {
            chartRef.current.applyOptions({
              width: chartContainerRef.current.clientWidth,
            });
          }
        };

        window.addEventListener('resize', handleResize);
      } catch (err) {
        console.error('Chart init error:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    initChart();

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, []);

  // Fetch candles when market or timeframe changes
  useEffect(() => {
    if (!market || !candleSeriesRef.current || !chartReady) {
      if (!market) {
        setLoading(false); // Don't show loading if no market selected
      }
      return;
    }

    const fetchCandles = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const intervalMap = {
          '1m': '1m',
          '5m': '5m',
          '15m': '15m',
          '1H': '1h',
          '4H': '4h',
          '1D': '1d',
        };

        console.log(`Fetching ${market} candles for ${timeframe}...`);

        const response = await fetch(HYPERLIQUID_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'candleSnapshot',
            req: {
              coin: market,
              interval: intervalMap[timeframe],
              startTime: Date.now() - 7 * 24 * 60 * 60 * 1000,
              endTime: Date.now(),
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log(`Received ${data?.length || 0} candles`);

        if (data && Array.isArray(data) && data.length > 0) {
          const candles = data.map((c) => ({
            time: Math.floor(c.t / 1000),
            open: parseFloat(c.o),
            high: parseFloat(c.h),
            low: parseFloat(c.l),
            close: parseFloat(c.c),
          }));

          candleSeriesRef.current.setData(candles);
          
          // Set visible range to show 60 candles (more zoomed in for better detail)
          if (chartRef.current && candles.length > 0) {
            const candlesToShow = Math.min(60, candles.length);
            const fromIndex = Math.max(0, candles.length - candlesToShow);
            chartRef.current.timeScale().setVisibleRange({
              from: candles[fromIndex].time,
              to: candles[candles.length - 1].time,
            });
          }
          
          setLoading(false);
        } else {
          setError('No data available');
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch Hyperliquid candles:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchCandles();
  }, [market, timeframe, chartReady, refreshKey]);

  const fmt = (n) => '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const pct = (from, to) => ((to - from) / from * 100).toFixed(2) + '%';

  const drawPositionLines = ({ entry, takeProfit, stopLoss }) => {
    if (!candleSeriesRef.current) return;

    entryLineRef.current?.remove();
    tpLineRef.current?.remove();
    slLineRef.current?.remove();

    if (entry && showTPSL) {
      entryLineRef.current = candleSeriesRef.current.createPriceLine({
        price: entry,
        color: '#00E3A7',
        lineWidth: 2,
        lineStyle: 0,
        title: `ENTRY ${fmt(entry)}`,
      });
    }
    if (takeProfit && showTPSL) {
      tpLineRef.current = candleSeriesRef.current.createPriceLine({
        price: takeProfit,
        color: '#2DD4BF',
        lineWidth: 1,
        lineStyle: 2,
        title: `TP ${fmt(takeProfit)} (${entry ? pct(entry, takeProfit) : ''})`,
      });
    }
    if (stopLoss && showTPSL) {
      slLineRef.current = candleSeriesRef.current.createPriceLine({
        price: stopLoss,
        color: '#FF6B6B',
        lineWidth: 1,
        lineStyle: 2,
        title: `SL ${fmt(stopLoss)} (${entry ? pct(entry, stopLoss) : ''})`,
      });
    }
  };

  const setTradeMarkers = (tradeList = []) => {
    if (!candleSeriesRef.current) return;

    const markers = tradeList.map(t => ({
      time: t.time,
      position: t.side === 'buy' ? 'belowBar' : 'aboveBar',
      color: t.side === 'buy' ? '#00E3A7' : '#FF6B6B',
      shape: t.side === 'buy' ? 'arrowUp' : 'arrowDown',
      text: `${t.side.toUpperCase()} ${t.size}@${fmt(t.price)}`,
    }));

    currentMarkersRef.current = markers;
    if (showMarkers) {
      candleSeriesRef.current.setMarkers(markers);
    }
    setTrades(tradeList);
  };

  useEffect(() => {
    if (!candleSeriesRef.current) return;
    if (showMarkers) {
      candleSeriesRef.current.setMarkers(currentMarkersRef.current);
    } else {
      candleSeriesRef.current.setMarkers([]);
    }
  }, [showMarkers]);

  useEffect(() => {
    if (!chartReady || !userAddress || !market) return;

    const fetchUserPositions = async () => {
      try {
        const response = await fetch(HYPERLIQUID_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'clearinghouseState',
            user: userAddress,
          }),
        });

        const data = await response.json();
        
        if (data?.assetPositions) {
          const position = data.assetPositions.find(p => p.position.coin === market);
          if (position?.position?.szi) {
            const entryPx = parseFloat(position.position.entryPx);
            const szi = parseFloat(position.position.szi);
            const isLong = szi > 0;
            
            const tpDistance = isLong ? 0.02 : -0.02;
            const slDistance = isLong ? -0.01 : 0.01;
            
            drawPositionLines({
              entry: entryPx,
              takeProfit: entryPx * (1 + tpDistance),
              stopLoss: entryPx * (1 + slDistance),
            });
          }
        }
      } catch (err) {
        console.warn('Could not fetch positions:', err);
      }
    };

    fetchUserPositions();
    const interval = setInterval(fetchUserPositions, 5000);
    return () => clearInterval(interval);
  }, [market, userAddress, chartReady, showTPSL]);

  const timeframes = ['1m', '5m', '15m', '1H', '4H', '1D'];

  return (
    <>
      <div className="chart-controls">
        <div className="timeframes">
          {timeframes.map((tf) => (
            <button
              key={tf}
              className={`timeframe-btn ${timeframe === tf ? 'active' : ''}`}
              onClick={() => setTimeframe(tf)}
            >
              {tf}
            </button>
          ))}
        </div>
        <div className="chart-settings-wrapper">
          <div className="chart-settings-btn" onClick={() => setShowSettings(!showSettings)}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/>
            </svg>
          </div>
          {showSettings && (
            <>
              <div className="chart-settings-backdrop" onClick={() => setShowSettings(false)} />
              <div className="chart-settings-dropdown">
                <button 
                  className="dropdown-restart-btn" 
                  onClick={() => {
                    setRefreshKey(k => k + 1);
                    setShowSettings(false);
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 3a5 5 0 104.546 2.914.5.5 0 00-.908-.417A4 4 0 118 4a.5.5 0 000-1z"/>
                    <path d="M8 4.466V.534a.25.25 0 01.41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 018 4.466z"/>
                  </svg>
                  Restart Chart
                </button>

                <div className="dropdown-divider"></div>

                <label className="dropdown-option">
                  <div className="option-info">
                    <div className="option-label">TP/SL Lines</div>
                    <div className="option-desc">Take profit & stop loss</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={showTPSL}
                    onChange={(e) => setShowTPSL(e.target.checked)}
                  />
                </label>
                <label className="dropdown-option">
                  <div className="option-info">
                    <div className="option-label">Trade Markers</div>
                    <div className="option-desc">Buy/sell arrows on chart</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={showMarkers}
                    onChange={(e) => setShowMarkers(e.target.checked)}
                  />
                </label>
              </div>
            </>
          )}
        </div>
      </div>
      <div style={{ position: 'relative', width: '100%', height: '300px' }}>
        {/* Chart Watermark */}
        <div className="chart-watermark">
          HyperLeverage {market}/USD
        </div>
        
        {loading && !error && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: '#A6B0BD',
              fontSize: '14px',
              zIndex: 10,
            }}
          >
            Loading {market} chart...
          </div>
        )}
        {error && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: '#FF6B6B',
              fontSize: '12px',
              zIndex: 10,
              textAlign: 'center',
            }}
          >
            Error: {error}
          </div>
        )}
        <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
      </div>
      {trades.length > 0 && (
        <div className="trade-history">
          <div className="history-title">Recent Trades</div>
          {trades.slice(-10).reverse().map((t, i) => (
            <div key={i} className="history-row">
              <div>
                <span className={`trade-side ${t.side}`}>{t.side.toUpperCase()}</span>
                <span className="trade-time">{new Date(t.time * 1000).toLocaleTimeString()}</span>
              </div>
              <div>
                <span className="trade-price">{fmt(t.price)}</span>
                <span className="trade-sep">·</span>
                <span className="trade-size">{t.size}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
