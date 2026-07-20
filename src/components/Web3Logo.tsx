import type { ComponentType } from 'react';
import NetworkAptos from '@web3icons/react/icons/networks/NetworkAptos';
import NetworkArbitrumOne from '@web3icons/react/icons/networks/NetworkArbitrumOne';
import NetworkAvalanche from '@web3icons/react/icons/networks/NetworkAvalanche';
import NetworkBase from '@web3icons/react/icons/networks/NetworkBase';
import NetworkBinanceSmartChain from '@web3icons/react/icons/networks/NetworkBinanceSmartChain';
import NetworkBitcoin from '@web3icons/react/icons/networks/NetworkBitcoin';
import NetworkCardano from '@web3icons/react/icons/networks/NetworkCardano';
import NetworkEthereum from '@web3icons/react/icons/networks/NetworkEthereum';
import NetworkHyperEvm from '@web3icons/react/icons/networks/NetworkHyperEvm';
import NetworkLinea from '@web3icons/react/icons/networks/NetworkLinea';
import NetworkLitecoin from '@web3icons/react/icons/networks/NetworkLitecoin';
import NetworkMantle from '@web3icons/react/icons/networks/NetworkMantle';
import NetworkNearProtocol from '@web3icons/react/icons/networks/NetworkNearProtocol';
import NetworkOptimism from '@web3icons/react/icons/networks/NetworkOptimism';
import NetworkPolkadot from '@web3icons/react/icons/networks/NetworkPolkadot';
import NetworkPolygon from '@web3icons/react/icons/networks/NetworkPolygon';
import NetworkScroll from '@web3icons/react/icons/networks/NetworkScroll';
import NetworkSolana from '@web3icons/react/icons/networks/NetworkSolana';
import NetworkSui from '@web3icons/react/icons/networks/NetworkSui';
import NetworkTron from '@web3icons/react/icons/networks/NetworkTron';
import NetworkUnichain from '@web3icons/react/icons/networks/NetworkUnichain';
import NetworkXrp from '@web3icons/react/icons/networks/NetworkXrp';
import TokenADA from '@web3icons/react/icons/tokens/TokenADA';
import TokenAPT from '@web3icons/react/icons/tokens/TokenAPT';
import TokenARB from '@web3icons/react/icons/tokens/TokenARB';
import TokenAVAX from '@web3icons/react/icons/tokens/TokenAVAX';
import TokenBCH from '@web3icons/react/icons/tokens/TokenBCH';
import TokenBNB from '@web3icons/react/icons/tokens/TokenBNB';
import TokenBTC from '@web3icons/react/icons/tokens/TokenBTC';
import TokenDOGE from '@web3icons/react/icons/tokens/TokenDOGE';
import TokenDOT from '@web3icons/react/icons/tokens/TokenDOT';
import TokenETH from '@web3icons/react/icons/tokens/TokenETH';
import TokenHYPE from '@web3icons/react/icons/tokens/TokenHYPE';
import TokenLTC from '@web3icons/react/icons/tokens/TokenLTC';
import TokenMATIC from '@web3icons/react/icons/tokens/TokenMATIC';
import TokenMNT from '@web3icons/react/icons/tokens/TokenMNT';
import TokenNEAR from '@web3icons/react/icons/tokens/TokenNEAR';
import TokenOP from '@web3icons/react/icons/tokens/TokenOP';
import TokenPOL from '@web3icons/react/icons/tokens/TokenPOL';
import TokenSOL from '@web3icons/react/icons/tokens/TokenSOL';
import TokenSUI from '@web3icons/react/icons/tokens/TokenSUI';
import TokenTON from '@web3icons/react/icons/tokens/TokenTON';
import TokenTRX from '@web3icons/react/icons/tokens/TokenTRX';
import TokenUSDC from '@web3icons/react/icons/tokens/TokenUSDC';
import TokenUSDT from '@web3icons/react/icons/tokens/TokenUSDT';
import TokenXMR from '@web3icons/react/icons/tokens/TokenXMR';
import TokenXRP from '@web3icons/react/icons/tokens/TokenXRP';

type LogoComponent = ComponentType<{
  size?: string | number;
  variant?: 'mono' | 'branded' | 'background';
  className?: string;
  'aria-hidden'?: boolean;
}>;

const chainLogos: Record<string, LogoComponent> = {
  BTC: NetworkBitcoin,
  LTC: NetworkLitecoin,
  DOGE: TokenDOGE,
  BCH: TokenBCH,
  ETH: NetworkEthereum,
  BNB: NetworkBinanceSmartChain,
  POLYGON: NetworkPolygon,
  ARBITRUM: NetworkArbitrumOne,
  OPTIMISM: NetworkOptimism,
  BASE: NetworkBase,
  AVAX_C: NetworkAvalanche,
  HYPEREVM: NetworkHyperEvm,
  HYPERCORE: TokenHYPE,
  MANTLE: NetworkMantle,
  LINEA: NetworkLinea,
  SCROLL: NetworkScroll,
  UNICHAIN: NetworkUnichain,
  TRON: NetworkTron,
  XRP: NetworkXrp,
  SOLANA: NetworkSolana,
  TON: TokenTON,
  APTOS: NetworkAptos,
  SUI: NetworkSui,
  ADA: NetworkCardano,
  DOT: NetworkPolkadot,
  NEAR: NetworkNearProtocol,
  XMR: TokenXMR,
};

const tokenLogos: Record<string, LogoComponent> = {
  ADA: TokenADA,
  APT: TokenAPT,
  ARB: TokenARB,
  AVAX: TokenAVAX,
  BCH: TokenBCH,
  BNB: TokenBNB,
  BTC: TokenBTC,
  DOGE: TokenDOGE,
  DOT: TokenDOT,
  ETH: TokenETH,
  HYPE: TokenHYPE,
  LTC: TokenLTC,
  MATIC: TokenMATIC,
  MNT: TokenMNT,
  NEAR: TokenNEAR,
  OP: TokenOP,
  POL: TokenPOL,
  SOL: TokenSOL,
  SUI: TokenSUI,
  TON: TokenTON,
  TRX: TokenTRX,
  USDC: TokenUSDC,
  USDT: TokenUSDT,
  XMR: TokenXMR,
  XRP: TokenXRP,
};

function LogoFallback({ value, size }: { value: string; size: number }) {
  return (
    <span className="web3-logo-fallback" style={{ width: size, height: size }} aria-hidden>
      {value.replaceAll('_', '').slice(0, 2)}
    </span>
  );
}

export function ChainLogo({ chain, size = 38 }: { chain: string; size?: number }) {
  const normalized = chain.toUpperCase();
  const Logo = chainLogos[normalized];
  return (
    <span className="web3-logo" title={chain}>
      {Logo
        ? <Logo variant="branded" size={size} aria-hidden />
        : <LogoFallback value={normalized} size={size} />}
    </span>
  );
}

export function AssetLogo({ symbol, size = 24 }: { symbol: string; size?: number }) {
  const normalized = symbol.toUpperCase().replace(/^ETH_.+$/, 'ETH');
  const Logo = tokenLogos[normalized];
  return (
    <span className="web3-logo" title={symbol}>
      {Logo
        ? <Logo variant="branded" size={size} aria-hidden />
        : <LogoFallback value={normalized} size={size} />}
    </span>
  );
}
