// src/lib/dexscreener.ts

export interface DexScreenerPair {
  chainId: string;
  baseToken: { address: string; symbol: string };
  priceUsd: string;
}

export interface DexScreenerResponse {
  pairs: DexScreenerPair[] | null;
}

export async function getDexScreenerPrices(addresses: string[]): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();
  if (!addresses || addresses.length === 0) return priceMap;

  // DexScreener API supports up to 30 addresses per comma-separated request
  const CHUNK_SIZE = 30;
  for (let i = 0; i < addresses.length; i += CHUNK_SIZE) {
    const chunk = addresses.slice(i, i + CHUNK_SIZE);
    const url = `https://api.dexscreener.com/latest/dex/tokens/${chunk.join(",")}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`[DexScreener] API error fetching chunk ${i}: ${response.statusText}`);
        continue;
      }

      const data: DexScreenerResponse = await response.json();
      if (!data.pairs) continue;

      // Group pairs by token and take the one with highest liquidity for base tokens
      for (const pair of data.pairs) {
        // Enforce base chain to avoid cross-chain confusion
        if (pair.chainId !== "base") continue;

        const addr = pair.baseToken.address.toLowerCase();
        const price = parseFloat(pair.priceUsd);
        if (isNaN(price)) continue;

        if (!priceMap.has(addr)) {
          priceMap.set(addr, price);
        }
      }
    } catch (e) {
      console.warn(`[DexScreener] Network error fetching prices:`, e);
    }
  }

  return priceMap;
}
