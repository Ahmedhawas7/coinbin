// src/lib/zerox.ts
import { ZEROX_API_URL, ZEROX_API_KEY, SLIPPAGE } from "@/config/contracts";

export async function get0xQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  taker: string
) {
  const params = new URLSearchParams({
    sellToken: tokenIn,
    buyToken: tokenOut,
    sellAmount: amountIn,
    slippagePercentage: SLIPPAGE.toString(),
    takerAddress: taker,
  });

  const url = `${ZEROX_API_URL}?${params.toString()}`;

  const res = await fetch(url, {
    headers: {
      "0x-api-key": ZEROX_API_KEY,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const msg = errorData.reason || errorData.message || "0x quote failed";
    throw new Error(`0x Error (${res.status}): ${msg}`);
  }

  return await res.json();
}
