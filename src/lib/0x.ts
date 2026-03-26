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

export async function get0xQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  taker: string,
  slippage: number = SLIPPAGE
): Promise<ZeroXQuote | null> {
  try {
    const params = new URLSearchParams({
      sellToken: tokenIn,
      buyToken: tokenOut,
      sellAmount: amountIn,
      takerAddress: taker,
      slippagePercentage: slippage.toString(),
    });

    const res = await fetch(`${ZEROX_API_URL}?${params.toString()}`, {
      headers: {
        "0x-api-key": ZEROX_API_KEY,
      },
    });

    if (!res.ok) {
      return null;
    }

    return await res.json();
  } catch (error) {
    console.error("0x Quote Error:", error);
    return null;
  }
}

export async function get0xPrice(
  tokenIn: string,
  tokenOut: string,
  amountIn: string
): Promise<{ price: string; buyAmount: string } | null> {
  try {
    const params = new URLSearchParams({
      sellToken: tokenIn,
      buyToken: tokenOut,
      sellAmount: amountIn,
    });

    const url = ZEROX_API_URL.replace("/quote", "/price");
    const res = await fetch(`${url}?${params.toString()}`, {
      headers: {
        "0x-api-key": ZEROX_API_KEY,
      },
    });

    if (!res.ok) {
      return null;
    }

    return await res.json();
  } catch (error) {
    console.error("0x Price Error:", error);
    return null;
  }
}
