import { useState } from 'react';

export default function TradingSections({ account, leverage, setShowLeverageModal, getLeverageColor, balance = 0, marginUsed = 0, unrealizedPnl = 0 }) {
  const [activeSection, setActiveSection] = useState('Balances');

  // Force clear balances if no account (safety check)
  const safeBalance = account ? balance : 0;
  const safeMarginUsed = account ? marginUsed : 0;
  const safeUnrealizedPnl = account ? unrealizedPnl : 0;

  const sections = [
    'Balances',
    'Positions', 
    'Open Orders',
    'TWAP',
    'Trade History',
    'Funding History',
    'Order History'
  ];

  return (
    <div className="trading-sections">
      {/* Sticky Tabs */}
      <div className="trading-tabs">
        {sections.map(section => (
          <button
            key={section}
            className={`trading-tab ${activeSection === section ? 'active' : ''}`}
            onClick={() => setActiveSection(section)}
          >
            {section}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="trading-content">
        {activeSection === 'Balances' && (
          <div className="balances-section">
            <div className="balance-row">
              <span className="balance-label">Available</span>
              <span className="balance-value">{safeBalance.toFixed(4)} USDC</span>
            </div>
            <div className="balance-row">
              <span className="balance-label">Margin Used</span>
              <span className="balance-value">{safeMarginUsed.toFixed(4)} USDC</span>
            </div>
            <div className="balance-row">
              <span className="balance-label">Unrealized PnL</span>
              <span className={`balance-value ${safeUnrealizedPnl >= 0 ? 'positive' : 'negative'}`}>
                {safeUnrealizedPnl >= 0 ? '+' : ''}{safeUnrealizedPnl.toFixed(4)} USDC
              </span>
            </div>
          </div>
        )}

        {activeSection === 'Positions' && (
          <div className="positions-section">
            <table className="trading-table">
              <thead>
                <tr>
                  <th>Market</th>
                  <th>Size</th>
                  <th>Entry</th>
                  <th>Mark</th>
                  <th>PnL</th>
                  <th>TP/SL</th>
                </tr>
              </thead>
              <tbody>
                <tr className="empty-state">
                  <td colSpan="6">
                    {account ? 'No open positions' : 'Connect wallet to view positions'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {activeSection === 'Open Orders' && (
          <div className="orders-section">
            <table className="trading-table">
              <thead>
                <tr>
                  <th>Market</th>
                  <th>Type</th>
                  <th>Side</th>
                  <th>Size</th>
                  <th>Price</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="empty-state">
                  <td colSpan="6">
                    {account ? 'No open orders' : 'Connect wallet to view orders'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {activeSection === 'TWAP' && (
          <div className="twap-section">
            <div className="empty-state-message">
              <p>TWAP orders allow you to execute large trades over time</p>
              <p className="coming-soon">Coming soon</p>
            </div>
          </div>
        )}

        {activeSection === 'Trade History' && (
          <div className="history-section">
            <table className="trading-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Market</th>
                  <th>Side</th>
                  <th>Size</th>
                  <th>Price</th>
                  <th>Fee</th>
                </tr>
              </thead>
              <tbody>
                <tr className="empty-state">
                  <td colSpan="6">
                    {account ? 'No trade history' : 'Connect wallet to view history'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {activeSection === 'Funding History' && (
          <div className="funding-section">
            <table className="trading-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Market</th>
                  <th>Rate</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                <tr className="empty-state">
                  <td colSpan="4">
                    {account ? 'No funding history' : 'Connect wallet to view funding'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {activeSection === 'Order History' && (
          <div className="order-history-section">
            <table className="trading-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Market</th>
                  <th>Type</th>
                  <th>Side</th>
                  <th>Size</th>
                  <th>Price</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="empty-state">
                  <td colSpan="7">
                    {account ? 'No order history' : 'Connect wallet to view history'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
