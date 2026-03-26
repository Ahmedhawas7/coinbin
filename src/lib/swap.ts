// src/lib/swap.ts
import { get0xQuote, type ZeroXQuote } from "./0x";
import { TOKENS } from "@/config/contracts";

export interface SwapInstance {
  tokenAddress: string;
  symbol: string;
  amountIn: bigint;
  quote: ZeroXQuote | null;
}

export async function buildSwap(
  tokenAddress: string,
  symbol: string,
  amountIn: bigint,
  taker: string,
  slippage?: number
): Promise<SwapInstance> {
  const quote = await get0xQuote(tokenAddress, TOKENS.USDC, amountIn.toString(), taker, slippage);
  
  return {
    tokenAddress,
    symbol,
    amountIn,
    quote,
  };
}
