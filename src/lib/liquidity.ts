// src/lib/liquidity.ts
import { ethers } from "ethers";
import { 
  TOKENS, 
  UNISWAP_V2_FACTORY, 
  UNISWAP_V3_FACTORY, 
  AERODROME_FACTORY, 
  BASESWAP_FACTORY,
  UNISWAP_V2_ROUTER,
  BASESWAP_ROUTER,
  AERODROME_ROUTER,
  UNISWAP_V3_QUOTER,
  V2_FACTORY_ABI,
  V3_FACTORY_ABI,
  AERODROME_FACTORY_ABI,
  AERODROME_ROUTER_ABI,
  QUOTER_ABI,
  FEE_TIERS
} from "@/config/contracts";

const RPC_URL = "https://mainnet.base.org";
const provider = new ethers.JsonRpcProvider(RPC_URL);

export interface LiquidityDiscovery {
  hasPool: boolean;
  bestBaseToken: string;
  dexSource: string;
  bestAmountOut: bigint;
  path: string[];
}

const BASE_ASSETS = [TOKENS.USDC, TOKENS.WETH, "0xd9AAEc86B65D86f6A7B5B1b0c42FFA531710b6CA".toLowerCase()]; // USDC, WETH, USDbC

const V2_ROUTER_ABI = ["function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)"];

/**
 * Finds the best liquidity route across all supported DEXs
 */
export async function discoverPools(tokenAddress: string, amountIn: bigint = BigInt(1e18)): Promise<LiquidityDiscovery> {
  const addr = tokenAddress.toLowerCase();
  
  if (BASE_ASSETS.includes(addr)) {
    return { hasPool: true, bestBaseToken: TOKENS.USDC, dexSource: "NATIVE", bestAmountOut: amountIn, path: [addr] };
  }

  let bestResult: LiquidityDiscovery = { hasPool: false, bestBaseToken: "", dexSource: "", bestAmountOut: 0n, path: [] };

  const paths = [
    [addr, TOKENS.USDC.toLowerCase()],
    [addr, TOKENS.WETH.toLowerCase()],
    [addr, "0xd9AAEc86B65D86f6A7B5B1b0c42FFA531710b6CA".toLowerCase()], // USDbC
    [addr, TOKENS.WETH.toLowerCase(), TOKENS.USDC.toLowerCase()],
    [addr, TOKENS.WETH.toLowerCase(), "0xd9AAEc86B65D86f6A7B5B1b0c42FFA531710b6CA".toLowerCase()],
  ];

  // 1. Check Uniswap V2 & BaseSwap
  const v2Routers = [
    { addr: UNISWAP_V2_ROUTER, name: "Uniswap V2" },
    { addr: BASESWAP_ROUTER, name: "BaseSwap" }
  ];

  for (const router of v2Routers) {
    const contract = new ethers.Contract(router.addr, V2_ROUTER_ABI, provider);
    for (const path of paths) {
      if (path.length > 3) continue; // standard V2 usually 2-3 hops
      try {
        const amounts = await contract.getAmountsOut(amountIn, path);
        const out = BigInt(amounts[amounts.length - 1]);
        // Normalize to USDC for comparison (crude: if out is WETH, this isn't perfect, but scanner will handle final pricing)
        // For now, we prefer the path that actually returns the target or a base asset
        if (out > bestResult.bestAmountOut) {
          bestResult = { hasPool: true, bestBaseToken: path[path.length - 1], dexSource: router.name, bestAmountOut: out, path };
        }
      } catch (e) {}
    }
  }

  // 2. Check Aerodrome
  try {
    const contract = new ethers.Contract(AERODROME_ROUTER, AERODROME_ROUTER_ABI, provider);
    for (const path of paths) {
      // Build Aerodrome routes (all volatile for discovery)
      const routes = [];
      for (let i = 0; i < path.length - 1; i++) {
        routes.push({ from: path[i], to: path[i+1], stable: false });
      }
      try {
        const amounts = await contract.getAmountsOut(amountIn, routes);
        const out = BigInt(amounts[amounts.length - 1]);
        if (out > bestResult.bestAmountOut) {
          bestResult = { hasPool: true, bestBaseToken: path[path.length - 1], dexSource: "Aerodrome", bestAmountOut: out, path };
        }
      } catch (e) {}
    }
  } catch (e) {}

  // 3. Check Uniswap V3
  try {
    const quoter = new ethers.Contract(UNISWAP_V3_QUOTER, QUOTER_ABI, provider);
    // V3 doesn't easily support multi-hop in a single static call without complex encoding, 
    // so we check direct pools first
    for (const base of BASE_ASSETS) {
      for (const fee of Object.values(FEE_TIERS)) {
        try {
          const params = {
            tokenIn: addr,
            tokenOut: base,
            amountIn: amountIn,
            fee: fee,
            sqrtPriceLimitX96: 0
          };
          const quote = await quoter.quoteExactInputSingle.staticCall(params);
          const out = BigInt(quote.amountOut);
          if (out > bestResult.bestAmountOut) {
            bestResult = { hasPool: true, bestBaseToken: base, dexSource: `Uniswap V3 (${fee/10000}%)`, bestAmountOut: out, path: [addr, base] };
          }
        } catch (e) {}
      }
    }
  } catch (e) {}

  return bestResult;
}
