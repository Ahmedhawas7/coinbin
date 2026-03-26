// src/lib/swap.ts
import { get0xQuote, type ZeroXQuote } from "./0x";
import { TOKENS, UNISWAP_V2_ROUTER, AERODROME_ROUTER } from "@/config/contracts";
import { discoverPools } from "./liquidity";

export interface DexQuote {
  router: string;
  path: string[];
  amountOutMin: string;
  isAerodrome: boolean;
}

export interface SwapInstance {
  tokenAddress: string;
  symbol: string;
  amountIn: bigint;
  quote: ZeroXQuote | null;
  dexQuote?: DexQuote | null;
}

export async function buildSwap(
  tokenAddress: string,
  symbol: string,
  amountIn: bigint,
  taker: string,
  slippage: number = 0.01
): Promise<SwapInstance> {
  let quote: ZeroXQuote | null = null;
  let dexQuote: DexQuote | null = null;

  // 1. Try 0x First (Aggregator)
  try {
    quote = await get0xQuote(tokenAddress, TOKENS.USDC, amountIn.toString(), taker, slippage);
  } catch (e) {
    console.warn(`[Swap] 0x quote failed for ${symbol}, trying DEX fallback...`);
  }

  // 2. DEX Fallback (If 0x fails)
  if (!quote) {
    try {
      const discovery = await discoverPools(tokenAddress, amountIn);
      if (discovery.hasPool && discovery.path.length > 0) {
        const minOut = (discovery.bestAmountOut * BigInt(Math.floor((1 - slippage) * 10000))) / 10000n;
        
        let routerAddr: string = UNISWAP_V2_ROUTER;
        if (discovery.dexSource.includes("Aerodrome")) routerAddr = AERODROME_ROUTER as string;
        if (discovery.dexSource.includes("BaseSwap")) routerAddr = "0x327Df1E6de55d39693ef2dB97316A734D7A13B6B";

        dexQuote = {
          router: routerAddr,
          path: discovery.path,
          amountOutMin: minOut.toString(),
          isAerodrome: discovery.dexSource.includes("Aerodrome")
        };
        console.log(`[Swap] ✅ DEX Fallback built for ${symbol} via ${discovery.dexSource}`);
      }
    } catch (e) {
      console.error(`[Swap] DEX Fallback failed for ${symbol}:`, e);
    }
  }
  
  return {
    tokenAddress,
    symbol,
    amountIn,
    quote,
    dexQuote
  };
}
