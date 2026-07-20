export const commonChainNames = [
  'BTC', 'LTC', 'DOGE', 'BCH',
  'ETH', 'BNB', 'POLYGON', 'ARBITRUM', 'OPTIMISM', 'BASE', 'AVAX_C',
  'HYPEREVM', 'MANTLE', 'LINEA', 'SCROLL', 'UNICHAIN', 'HYPERCORE',
  'TRON', 'XRP', 'SOLANA', 'TON', 'APTOS', 'SUI', 'ADA', 'DOT', 'NEAR', 'XMR',
] as const;

export const commonChainOptions = commonChainNames.map((value) => ({ value }));
