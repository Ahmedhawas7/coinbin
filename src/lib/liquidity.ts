// src/lib/liquidity.ts
import { ethers } from "ethers";
import { 
  TOKENS, 
  UNISWAP_V2_FACTORY, 
  UNISWAP_V3_FACTORY, 
  AERODROME_FACTORY, 
  BASESWAP_FACTORY,
  V2_FACTORY_ABI,
  V3_FACTORY_ABI,
  AERODROME_FACTORY_ABI,
  FEE_TIERS
} from "@/config/contracts";

const RPC_URL = "https://mainnet.base.org";
const provider = new ethers.JsonRpcProvider(RPC_URL);

export interface LiquidityDiscovery {
  hasPool: boolean;
  bestBaseToken: string;
  dexSource: string;
}

const BASE_ASSETS = [TOKENS.USDC, TOKENS.WETH, "0xd9AAEc86B65D86f6A7B5B1b0c42FFA531710b6CA"]; // USDC, WETH, USDbC

/**
 * Checks for existence of liquidity pools across major Base DEXs
 */
export async function discoverPools(tokenAddress: string): Promise<LiquidityDiscovery> {
  const addr = tokenAddress.toLowerCase();
  
  // If it's already a base asset, it's liquid
  if (BASE_ASSETS.some(b => b.toLowerCase() === addr)) {
    return { hasPool: true, bestBaseToken: TOKENS.USDC, dexSource: "NATIVE" };
  }

  // 1. Check Uniswap V2 / BaseSwap
  const v2Factories = [
    { addr: UNISWAP_V2_FACTORY, name: "Uniswap V2" },
    { addr: BASESWAP_FACTORY, name: "BaseSwap" }
  ];

  for (const factory of v2Factories) {
    const contract = new ethers.Contract(factory.addr, V2_FACTORY_ABI, provider);
    for (const base of BASE_ASSETS) {
      try {
        const pair = await contract.getPair(tokenAddress, base);
        if (pair !== ethers.ZeroAddress) {
          return { hasPool: true, bestBaseToken: base, dexSource: factory.name };
        }
      } catch (e) {}
    }
  }

  // 2. Check Aerodrome
  try {
    const factory = new ethers.Contract(AERODROME_FACTORY, AERODROME_FACTORY_ABI, provider);
    for (const base of BASE_ASSETS) {
      // Check both stable and volatile pools
      for (const stable of [true, false]) {
        const pool = await factory.getPool(tokenAddress, base, stable);
        if (pool !== ethers.ZeroAddress) {
          return { hasPool: true, bestBaseToken: base, dexSource: `Aerodrome (${stable ? "Stable" : "Volatile"})` };
        }
      }
    }
  } catch (e) {}

  // 3. Check Uniswap V3
  try {
    const factory = new ethers.Contract(UNISWAP_V3_FACTORY, V3_FACTORY_ABI, provider);
    for (const base of BASE_ASSETS) {
      for (const fee of Object.values(FEE_TIERS)) {
        const pool = await factory.getPool(tokenAddress, base, fee);
        if (pool !== ethers.ZeroAddress) {
          return { hasPool: true, bestBaseToken: base, dexSource: `Uniswap V3 (${fee/10000}%)` };
        }
      }
    }
  } catch (e) {}

  return { hasPool: false, bestBaseToken: "", dexSource: "" };
}
