// src/lib/0x.ts
import { ZEROX_API_URL, ZEROX_API_KEY, SLIPPAGE } from "@/config/contracts";

export interface ZeroXQuote {
  to: string;
  data: string;
  value: string;
  buyAmount: string;
  sellAmount: string;
  minBuyAmount: string;
  price: string;
  guaranteedPrice: string;
  estimatedGas: string;
  allowanceTarget: string;
}

/**
 * Fetches a swap quote for execution
 */
export async function get0xQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  taker: string,
  slippage: number = SLIPPAGE
): Promise<ZeroXQuote | null> {
  console.log(`[0x] Fetching QUOTE for ${tokenIn} -> ${tokenOut} | Amount: ${amountIn}`);
  try {
    const params = new URLSearchParams({
      sellToken: tokenIn,
      buyToken: tokenOut,
      sellAmount: amountIn,
      takerAddress: taker,
      slippagePercentage: (slippage / 10000).toString(), // Convert bps to percentage (e.g., 100 bps -> 0.01)
    });

    const res = await fetch(`${ZEROX_API_URL}?${params.toString()}`, {
      headers: {
        "0x-api-key": ZEROX_API_KEY,
      },
    });

    if (!res.ok) {
      const err = await res.json();
      console.error("[0x] Quote API Error:", err);
      return null;
    }

    const data = await res.json();
    console.log(`[0x] Quote received. Expected Buy Amount: ${data.buyAmount}`);
    return data;
  } catch (error) {
    console.error("[0x] Quote Fetch Exception:", error);
    return null;
  }
}

/**
 * Fetches price only (for enrichment/estimation)
 */
export async function get0xPrice(
  tokenIn: string,
  tokenOut: string,
  amountIn: string
): Promise<{ price: string; buyAmount: string; estimatedGas: string } | null> {
  console.log(`[0x] Fetching PRICE for ${tokenIn} -> ${tokenOut} | Amount: ${amountIn}`);
  try {
    const params = new URLSearchParams({
      sellToken: tokenIn,
      buyToken: tokenOut,
      sellAmount: amountIn,
    });

    // Use /price instead of /quote for estimation
    const priceUrl = ZEROX_API_URL.replace("/quote", "/price");
    
    const res = await fetch(`${priceUrl}?${params.toString()}`, {
      headers: {
        "0x-api-key": ZEROX_API_KEY,
      },
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    console.log(`[0x] Price discovered: ${data.price} | Buy Amount: ${data.buyAmount}`);
    return data;
  } catch (error) {
    console.error("[0x] Price Discovery Exception:", error);
    return null;
  }
}
