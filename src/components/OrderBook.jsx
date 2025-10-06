import { useState, useEffect } from 'react';

const HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info';

export default function OrderBook({ market }) {
  const [orderBook, setOrderBook] = useState({ bids: [], asks: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!market) return;

    const fetchOrderBook = async () => {
      try {
        const response = await fetch(HYPERLIQUID_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'l2Book',
            coin: market
          })
        });

        const data = await response.json();
        
        if (data?.levels) {
          const bids = data.levels[0]?.slice(0, 8) || [];
          const asks = data.levels[1]?.slice(0, 8) || [];
          
          setOrderBook({ bids, asks });
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to fetch order book:', error);
        setLoading(false);
      }
    };

    fetchOrderBook();
    const interval = setInterval(fetchOrderBook, 1000);
    return () => clearInterval(interval);
  }, [market]);

  const formatSize = (size) => {
    const num = parseFloat(size);
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    if (num >= 1) return num.toFixed(2);
    return num.toFixed(4);
  };

  const formatPrice = (price) => {
    const num = parseFloat(price);
    if (num >= 1000) return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (num >= 1) return num.toFixed(2);
    return num.toFixed(4);
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#A6B0BD' }}>
        Loading order book...
      </div>
    );
  }

  const maxBidSize = Math.max(...orderBook.bids.map(b => parseFloat(b.sz)));
  const maxAskSize = Math.max(...orderBook.asks.map(a => parseFloat(a.sz)));

  return (
    <div className="order-book">
      <div className="order-book-header">
        <div className="ob-col">Price</div>
        <div className="ob-col">Size</div>
        <div className="ob-col">Total</div>
      </div>

      {/* Asks (Sell Orders) - Reversed to show highest first */}
      <div className="asks-section">
        {[...orderBook.asks].reverse().map((ask, idx) => {
          const size = parseFloat(ask.sz);
          const price = parseFloat(ask.px);
          const total = size * price;
          const widthPercent = (size / maxAskSize) * 100;

          return (
            <div key={idx} className="order-row ask-row">
              <div className="order-bg ask-bg" style={{ width: `${widthPercent}%` }} />
              <div className="ob-col price ask-price">{formatPrice(price)}</div>
              <div className="ob-col">{formatSize(size)}</div>
              <div className="ob-col">{formatSize(total)}</div>
            </div>
          );
        })}
      </div>

      {/* Spread */}
      <div className="spread-section">
        {orderBook.bids.length > 0 && orderBook.asks.length > 0 && (
          <div className="spread">
            Spread: {(parseFloat(orderBook.asks[0].px) - parseFloat(orderBook.bids[0].px)).toFixed(2)}
          </div>
        )}
      </div>

      {/* Bids (Buy Orders) */}
      <div className="bids-section">
        {orderBook.bids.map((bid, idx) => {
          const size = parseFloat(bid.sz);
          const price = parseFloat(bid.px);
          const total = size * price;
          const widthPercent = (size / maxBidSize) * 100;

          return (
            <div key={idx} className="order-row bid-row">
              <div className="order-bg bid-bg" style={{ width: `${widthPercent}%` }} />
              <div className="ob-col price bid-price">{formatPrice(price)}</div>
              <div className="ob-col">{formatSize(size)}</div>
              <div className="ob-col">{formatSize(total)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
