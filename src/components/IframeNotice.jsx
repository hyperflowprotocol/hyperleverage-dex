export default function IframeNotice() {
  console.log('🚨 IframeNotice component is rendering!');
  
  const handleOpenNewTab = () => {
    window.open(window.location.href, '_blank', 'noopener');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      background: '#0a0e14',
      color: '#BFC8D6',
      textAlign: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        maxWidth: '400px',
        padding: '40px',
        background: '#151b23',
        borderRadius: '12px',
        border: '1px solid #1f2937'
      }}>
        <h2 style={{ 
          color: '#00E3A7', 
          marginBottom: '16px',
          fontSize: '24px',
          fontWeight: '600'
        }}>
          Hyper Leverage
        </h2>
        <p style={{ 
          marginBottom: '24px', 
          lineHeight: '1.6',
          fontSize: '15px'
        }}>
          Wallet connection is disabled in preview mode due to browser security restrictions.
        </p>
        <button 
          onClick={handleOpenNewTab}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #00E3A7 0%, #00D4E3 100%)',
            border: 0,
            color: '#0a0e14',
            fontWeight: '600',
            fontSize: '15px',
            cursor: 'pointer',
            width: '100%',
            transition: 'transform 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          Open in New Tab
        </button>
        <p style={{ 
          marginTop: '16px', 
          fontSize: '13px',
          color: '#6b7280'
        }}>
          The app will work perfectly in the new tab! ✨
        </p>
      </div>
    </div>
  );
}
