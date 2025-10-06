import { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import CustomSelect from './CustomSelect';

export default function TradeBar({ 
  market, 
  price, 
  balance, 
  leverage, 
  setLeverage,
  getLeverageColor,
  account,
  maxLeverage = 50,
  markets = []
}) {
  const { signTypedData, login } = usePrivy();
  const { wallets } = useWallets();
  const [showSheet, setShowSheet] = useState(false);
  const [orderSide, setOrderSide] = useState('buy');
  const [orderType, setOrderType] = useState('market');
  const [limitPrice, setLimitPrice] = useState('');
  const [marginMode, setMarginMode] = useState('isolated');
  const [amount, setAmount] = useState('');
  const [size, setSize] = useState('');
  const [sizeMode, setSizeMode] = useState('quote');
  const [tpPrice, setTpPrice] = useState('');
  const [slPrice, setSlPrice] = useState('');
  const [amountPercent, setAmountPercent] = useState(0);

  const baseSymbol = market || 'BTC';
  const quoteSymbol = 'USDC';
  const feeRate = 0.0003;

  const notionalToSize = (amt) => (amt / price) * leverage;
  const sizeToNotional = (sz) => (sz * price) / leverage;
  const reqMargin = amount ? parseFloat(amount) / leverage : 0;
  const estFee = amount ? parseFloat(amount) * feeRate : 0;
  const estLiq = () => {
    if (!amount || !price) return 0;
    const margin = reqMargin;
    const distance = (margin * 0.9) / price;
    const pxMove = distance * price;
    return orderSide === 'buy' ? price - pxMove : price + pxMove;
  };

  useEffect(() => {
    if (sizeMode === 'notional' && amount) {
      setSize(notionalToSize(parseFloat(amount)).toFixed(4));
    }
  }, [amount, sizeMode, price, leverage]);

  useEffect(() => {
    if (sizeMode === 'contracts' && size) {
      setAmount(sizeToNotional(parseFloat(size)).toFixed(2));
    }
  }, [size, sizeMode, price, leverage]);

  const handleOpenSheet = (side) => {
    console.log('🔵 BUY/SELL BUTTON CLICKED:', side);
    setOrderSide(side);
    setShowSheet(true);
    console.log('🔵 Sheet should open now, showSheet =', true);
  };

  const handlePercentage = (pct) => {
    const target = balance * pct;
    setAmount(target.toFixed(2));
    setAmountPercent(Math.round(pct * 100));
  };

  const handlePlaceOrder = async () => {
    console.log('🔍 Order placement attempt:', { account, walletsCount: wallets.length, wallets });
    
    if (!account) {
      alert('Please connect your wallet first');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter an amount');
      return;
    }

    try {
      console.log('🚀 Placing order:', { orderSide, orderType, amount, size, sizeMode, market: baseSymbol });

      const isBuy = orderSide === 'buy';
      
      let orderSize;
      if (sizeMode === 'base') {
        orderSize = parseFloat(size) || 0;
      } else {
        const notionalAmount = parseFloat(amount) || 0;
        orderSize = (notionalAmount / price) * leverage;
      }
      
      if (orderSize <= 0) {
        alert('Invalid order size');
        return;
      }
      
      console.log(`📊 Order size: ${orderSize.toFixed(5)} ${baseSymbol} (from ${amount} USDC at ${price} with ${leverage}x leverage)`);

      const now = Date.now();
      
      const assetIndex = markets.findIndex(m => m.name === baseSymbol);
      if (assetIndex === -1) {
        alert(`Market ${baseSymbol} not found`);
        return;
      }

      const order = {
        a: assetIndex,
        b: isBuy,
        p: orderType === 'limit' ? limitPrice : price.toString(),
        s: orderSize.toString(),
        r: false,
        t: {
          limit: { tif: 'Gtc' }
        }
      };

      const action = {
        type: 'order',
        orders: [order],
        grouping: 'na'
      };

      const domain = {
        name: 'Exchange',
        version: '1',
        chainId: 1337,
        verifyingContract: '0x0000000000000000000000000000000000000000'
      };

      const types = {
        Agent: [
          { name: 'source', type: 'string' },
          { name: 'connectionId', type: 'bytes32' }
        ],
        HyperliquidTransaction: [
          { name: 'action', type: 'string' },
          { name: 'nonce', type: 'uint64' },
          { name: 'signature', type: 'Agent' }
        ]
      };

      const value = {
        action: JSON.stringify(action),
        nonce: now,
        signature: {
          source: 'HyperLeverage',
          connectionId: '0x0000000000000000000000000000000000000000000000000000000000000000'
        }
      };

      console.log('📝 Signing EIP-712 message with Privy...');
      
      const signature = await signTypedData({ domain, types, value }, {
        title: `${orderSide.toUpperCase()} ${baseSymbol}`,
        description: `Placing ${orderType} order for ${orderSize.toFixed(5)} ${baseSymbol}`,
        buttonText: 'Sign Order'
      });

      console.log('✅ Signature obtained:', signature.slice(0, 20) + '...');

      const response = await fetch('https://api.hyperliquid.xyz/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          nonce: now,
          signature: {
            r: signature.slice(0, 66),
            s: '0x' + signature.slice(66, 130),
            v: parseInt(signature.slice(130, 132), 16)
          },
          vaultAddress: null
        })
      });

      const result = await response.json();
      console.log('📊 Exchange response:', result);

      if (result.status === 'ok') {
        alert(`✅ ${orderSide.toUpperCase()} order placed successfully!`);
        setShowSheet(false);
      } else {
        alert(`❌ Order failed: ${result.response || 'Unknown error'}`);
      }

    } catch (error) {
      console.error('❌ Order placement error:', error);
      alert(`Error: ${error.message || 'Failed to place order'}`);
    }
  };

  return (
    <>
      {/* Minimal Bottom Bar - Hide when sheet is open */}
      {!showSheet && (
        <div className="trade-bar">
          <button 
            className="btn-sell" 
            onClick={() => {
              if (!account) {
                alert('⚠️ Please connect your wallet first\n\nTap the green "Connect Wallet" button at the top right to get started');
                return;
              }
              handleOpenSheet('sell');
            }}
          >
            SELL
          </button>
          <button 
            className="btn-buy" 
            onClick={() => {
              if (!account) {
                alert('⚠️ Please connect your wallet first\n\nTap the green "Connect Wallet" button at the top right to get started');
                return;
              }
              handleOpenSheet('buy');
            }}
          >
            BUY
          </button>
        </div>
      )}

      {/* Full Trade Sheet */}
      {showSheet && (
        <div className={`sheet ${showSheet ? 'show' : ''}`}>
          <div className="sheet-inner">
            {/* Trade Header */}
            <div className="trade-header">
              <div className="trade-header-top">
                <div>
                  <b>{orderSide === 'buy' ? 'Buy / Long' : 'Sell / Short'}</b>
                  <div className="muted">{baseSymbol}/USD Perpetual</div>
                </div>
                <button className="x" onClick={() => setShowSheet(false)}>✕</button>
              </div>
            </div>

            {/* Order Type & Margin Mode Dropdowns */}
            <div className="trade-options">
              <div className="option">
                <label>Order Type</label>
                <select 
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value)}
                >
                  <option value="market">Market</option>
                  <option value="limit">Limit</option>
                </select>
              </div>

              <div className="option">
                <label>Margin Mode</label>
                <select
                  value={marginMode}
                  onChange={(e) => setMarginMode(e.target.value)}
                >
                  <option value="isolated">Isolated</option>
                  <option value="cross">Cross</option>
                </select>
              </div>
            </div>

            {/* Limit Price (only for limit orders) */}
            {orderType === 'limit' && (
              <div className="field" style={{ marginBottom: '12px' }}>
                <label>Limit Price</label>
                <div className="input">
                  <input
                    type="number"
                    step="0.5"
                    placeholder={price?.toFixed(2) || '0.00'}
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    inputMode="decimal"
                  />
                  <span className="unit">USD</span>
                </div>
              </div>
            )}

            {/* Leverage (Full Width) */}
            <div className="lev">
              <div className="lev-row">
                <label>Leverage</label>
                <b style={{ color: getLeverageColor() }}>{leverage.toFixed(1)}x</b>
              </div>
              <input
                type="range"
                min="1"
                max={maxLeverage}
                step="0.1"
                value={leverage}
                onChange={(e) => setLeverage(parseFloat(e.target.value))}
                style={{
                  background: `linear-gradient(to right, ${getLeverageColor()} 0%, ${getLeverageColor()} ${((leverage - 1) / (maxLeverage - 1)) * 100}%, #1a1f24 ${((leverage - 1) / (maxLeverage - 1)) * 100}%, #1a1f24 100%)`
                }}
              />
              <div className="lev-meta">
                <span>Req. Margin: <b>${reqMargin.toFixed(2)}</b></span>
                <span>Est. Liq: <b>${estLiq().toFixed(2)}</b></span>
              </div>
            </div>

            {/* Amount Input with Unit Selector */}
            <div className="field">
              <label>Amount <span className="available">(Available: {balance.toFixed(2)} USDC)</span></label>
              <div className="input-with-select">
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  placeholder="0.0000"
                  value={sizeMode === 'base' ? size : amount}
                  onChange={(e) => {
                    if (sizeMode === 'base') {
                      setSize(e.target.value);
                    } else {
                      setAmount(e.target.value);
                    }
                  }}
                  inputMode="decimal"
                />
                <CustomSelect
                  value={sizeMode}
                  onChange={(e) => setSizeMode(e.target.value)}
                  options={[
                    { value: 'base', label: baseSymbol },
                    { value: 'quote', label: quoteSymbol }
                  ]}
                  className="unit-select"
                />
              </div>
              <div className="slider-container">
                <div className="slider-dots">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={amountPercent}
                  onChange={(e) => handlePercentage(parseFloat(e.target.value) / 100)}
                  className="percent-slider"
                  style={{
                    background: `linear-gradient(to right, #00E3A7 0%, #00E3A7 ${amountPercent}%, #1A1F24 ${amountPercent}%, #1A1F24 100%)`
                  }}
                />
                <span className="slider-value">{amountPercent}%</span>
              </div>
            </div>

            {/* TP/SL */}
            <div className="grid">
              <div className="field">
                <label>TP (optional)</label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="Price"
                  value={tpPrice}
                  onChange={(e) => setTpPrice(e.target.value)}
                />
              </div>
              <div className="field">
                <label>SL (optional)</label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="Price"
                  value={slPrice}
                  onChange={(e) => setSlPrice(e.target.value)}
                />
              </div>
            </div>

            {/* Preview */}
            <div className="rows">
              <div className="row">
                <span>Type</span>
                <b>{orderType.charAt(0).toUpperCase() + orderType.slice(1)}</b>
              </div>
              <div className="row">
                <span>Mark Price</span>
                <b>${price?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || '—'}</b>
              </div>
              <div className="row">
                <span>Est. Fee</span>
                <b>${estFee.toFixed(2)}</b>
              </div>
              <div className="row">
                <span>Mode</span>
                <b>{marginMode.charAt(0).toUpperCase() + marginMode.slice(1)}</b>
              </div>
            </div>

            <div className="sheet-actions">
              {orderSide === 'sell' ? (
                <button className="btn-sell btn-full" onClick={handlePlaceOrder}>
                  SELL
                </button>
              ) : (
                <button className="btn-buy btn-full" onClick={handlePlaceOrder}>
                  BUY
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
