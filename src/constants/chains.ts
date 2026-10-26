export const commonChainNames = [
  'BTC', 'LTC', 'DOGE', 'BCH',
  'ETH', 'BNB', 'POLYGON', 'ARBITRUM', 'OPTIMISM', 'BASE', 'AVAX_C',
  'HYPEREVM', 'LINEA', 'SCROLL', 'UNICHAIN', 'X_LAYER', 'ROBINHOOD_CHAIN', 'HYPERCORE',
  'TRON', 'XRP', 'SOLANA', 'TON', 'APTOS', 'SUI', 'ADA', 'DOT', 'NEAR', 'XMR',
] as const;

export const commonChainOptions = commonChainNames.map((value) => ({ value }));

const chainDisplayNames: Record<string, string> = {
  BTC: 'Bitcoin',
  LTC: 'Litecoin',
  DOGE: 'Dogecoin',
  BCH: 'Bitcoin Cash',
  ETH: 'Ethereum',
  BNB: 'BNB Smart Chain',
  POLYGON: 'Polygon',
  ARBITRUM: 'Arbitrum One',
  OPTIMISM: 'OP Mainnet',
  BASE: 'Base',
  AVAX_C: 'Avalanche C-Chain',
  HYPEREVM: 'HyperEVM',
  LINEA: 'Linea',
  SCROLL: 'Scroll',
  UNICHAIN: 'Unichain',
  X_LAYER: 'X Layer',
  ROBINHOOD_CHAIN: 'Robinhood Chain',
  HYPERCORE: 'HyperCore',
  TRON: 'TRON',
  XRP: 'XRP Ledger',
  SOLANA: 'Solana',
  TON: 'The Open Network',
  APTOS: 'Aptos',
  SUI: 'Sui',
  ADA: 'Cardano',
  DOT: 'Polkadot',
  NEAR: 'NEAR Protocol',
  XMR: 'Monero',
};

export function getChainDisplayName(chain: string) {
  return chainDisplayNames[chain.toUpperCase()] ?? chain;
}
