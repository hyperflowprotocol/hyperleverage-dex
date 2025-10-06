export function inIframe() {
  try {
    // Check if we're in an iframe
    if (window.self === window.top) {
      return false;
    }
    
    // We're in iframe - but is it Replit preview or wallet DApp browser?
    // Replit domains: replit.dev, repl.co
    const currentDomain = window.location.hostname;
    const isReplitDomain = currentDomain.includes('replit.dev') || currentDomain.includes('repl.co');
    
    // Only block Replit preview iframes, allow wallet DApp browsers
    return isReplitDomain;
  } catch {
    // Cross-origin error - could be either, but let's allow it for wallet DApps
    return false;
  }
}
