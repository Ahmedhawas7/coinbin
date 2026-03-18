// src/lib/tokens.ts
// Known token registry for Base Mainnet.
// Balances & prices are fetched on-chain / from Uniswap at runtime.

export interface TokenInfo {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  logoColor: string;
  logoLetter: string;
  logoUrl?: string;
  coingeckoId?: string;
}

// Well-known tokens on Base — extended list
export const KNOWN_TOKENS: TokenInfo[] = [
  {
    address: "0x4200000000000000000000000000000000000006",
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
    logoColor: "#627EEA",
    logoLetter: "E",
    logoUrl: "https://assets.coingecko.com/coins/images/2518/small/weth.png",
    coingeckoId: "weth",
  },
  {
    address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
    symbol: "cbBTC",
    name: "Coinbase Wrapped BTC",
    decimals: 8,
    logoColor: "#F7931A",
    logoLetter: "B",
    logoUrl: "https://assets.coingecko.com/coins/images/40143/small/cbbtc.webp",
    coingeckoId: "coinbase-wrapped-btc",
  },
  {
    address: "0x532F3Eff7B64E9DBF6f16E21C96d8Cd5a20E45e7",
    symbol: "BRETT",
    name: "Brett",
    decimals: 18,
    logoColor: "#FF6B35",
    logoLetter: "B",
    logoUrl: "https://assets.coingecko.com/coins/images/35529/small/brett.webp",
    coingeckoId: "based-brett",
  },
  {
    address: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
    symbol: "DEGEN",
    name: "Degen",
    decimals: 18,
    logoColor: "#A855F7",
    logoLetter: "D",
    logoUrl: "https://assets.coingecko.com/coins/images/34515/small/degen.png",
    coingeckoId: "degen-base",
  },
  {
    address: "0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4",
    symbol: "TOSHI",
    name: "Toshi",
    decimals: 18,
    logoColor: "#F59E0B",
    logoLetter: "T",
    coingeckoId: "toshi",
  },
  {
    address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
    symbol: "AERO",
    name: "Aerodrome Finance",
    decimals: 18,
    logoColor: "#10B981",
    logoLetter: "A",
    logoUrl: "https://assets.coingecko.com/coins/images/31745/small/token.png",
    coingeckoId: "aerodrome-finance",
  },
  {
    address: "0xFF8adeC2221f9f4D8dfbAFa6B9a297d17603493D",
    symbol: "WELL",
    name: "Moonwell",
    decimals: 18,
    logoColor: "#6366F1",
    logoLetter: "W",
    coingeckoId: "moonwell",
  },
  {
    address: "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b",
    symbol: "VIRTUAL",
    name: "Virtual Protocol",
    decimals: 18,
    logoColor: "#EC4899",
    logoLetter: "V",
    coingeckoId: "virtual-protocol",
  },
  {
    address: "0xca73ed1815e5915489570014e024b7EbE65dE679",
    symbol: "ODOS",
    name: "Odos",
    decimals: 18,
    logoColor: "#14B8A6",
    logoLetter: "O",
  },
  {
    address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
    logoColor: "#F5A623",
    logoLetter: "D",
    logoUrl: "https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png",
    coingeckoId: "dai",
  },
  {
    address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA",
    symbol: "USDbC",
    name: "USD Base Coin",
    decimals: 6,
    logoColor: "#2775CA",
    logoLetter: "U",
  },
  {
    address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
    symbol: "cbETH",
    name: "Coinbase Wrapped Staked ETH",
    decimals: 18,
    logoColor: "#627EEA",
    logoLetter: "E",
    coingeckoId: "coinbase-wrapped-staked-eth",
  },
  {
    address: "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452",
    symbol: "wstETH",
    name: "Wrapped liquid staked Ether 2.0",
    decimals: 18,
    logoColor: "#00A3FF",
    logoLetter: "W",
    coingeckoId: "wrapped-steth",
  },
  {
    address: "0x78A087d713BE963bf307B18f2ff8122Ef9A09AA0",
    symbol: "BSWAP",
    name: "BaseSwap Token",
    decimals: 18,
    logoColor: "#3B82F6",
    logoLetter: "B",
  },
  {
    address: "0x6985884C4392D348587B19cb9eAAf157F13271cd",
    symbol: "ZRO",
    name: "LayerZero",
    decimals: 18,
    logoColor: "#9333EA",
    logoLetter: "Z",
    coingeckoId: "layerzero",
  },
  {
    address: "0x0578d8A44db98B23BF096A382e016e29a5Ce0ffe",
    symbol: "HIGHER",
    name: "Higher",
    decimals: 18,
    logoColor: "#22C55E",
    logoLetter: "H",
    coingeckoId: "higher",
  },
  {
    address: "0x22E290b3A54954a1F857AcbD7E35F18e0b38F2B0",
    symbol: "MOCHI",
    name: "Mochi",
    decimals: 18,
    logoColor: "#FB923C",
    logoLetter: "M",
  },
  {
    address: "0x9e1028F5F1D5eDE59748FFceE5532509976840E0",
    symbol: "COMP",
    name: "Compound",
    decimals: 18,
    logoColor: "#00D395",
    logoLetter: "C",
    coingeckoId: "compound-governance-token",
  },
  {
    address: "0xd5046B976188EB40f6DE40fB527F89c05b323385",
    symbol: "BSX",
    name: "BasedX",
    decimals: 18,
    logoColor: "#0052FF",
    logoLetter: "B",
  },
  {
    address: "0xCfA3Ef56d303AE4fAabA0592388F19d7C3399FB4",
    symbol: "EURC",
    name: "Euro Coin",
    decimals: 6,
    logoColor: "#003399",
    logoLetter: "E",
    coingeckoId: "euro-coin",
  },
];

// Tokens that should never be sold (they ARE the output or stablecoins we keep)
export const UNSELLABLE = new Set([
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913".toLowerCase(), // USDC
  "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca".toLowerCase(), // USDbC
]);

// Useful common addresses
export const TOKENS = {
  USDC: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  WETH: "0x4200000000000000000000000000000000000006",
  cbBTC: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
};

export function getTokenInfo(address: string): TokenInfo | undefined {
  return KNOWN_TOKENS.find(
    (t) => t.address.toLowerCase() === address.toLowerCase()
  );
}
