// src/hooks/useTokenBalances.ts
// Fetches ALL ERC-20 token balances on Base via Alchemy API
// Falls back to static KNOWN_TOKENS list if Alchemy key not available.

import { useEffect, useState, useCallback } from "react";
import { usePublicClient, useAccount } from "wagmi";
import {
  MULTICALL3_ADDRESS,
  MULTICALL3_ABI,
  ERC20_ABI,
} from "@/config/contracts";
import { KNOWN_TOKENS, UNSELLABLE, type TokenInfo } from "@/lib/tokens";
import { encodeFunctionData, decodeFunctionResult, type Address } from "viem";

export interface TokenBalance extends TokenInfo {
  balance: bigint;
  balanceFormatted: number;
  usdPrice: number;
  usdValue: number;
  canSell: boolean;
  isUnknown?: boolean; // discovered dynamically
}

const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_KEY ?? "";
const ALCHEMY_BASE_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;

// ─── Fetch all ERC-20 token balances from Alchemy ─────────────────────────────
async function fetchAlchemyTokens(
  address: Address
): Promise<{ contractAddress: string; tokenBalance: string }[]> {
  if (!ALCHEMY_KEY) return [];
  try {
    const res = await fetch(ALCHEMY_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "alchemy_getTokenBalances",
        params: [address, "erc20"],
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.result?.tokenBalances ?? []).filter(
      (t: { tokenBalance: string }) => t.tokenBalance !== "0x0000000000000000000000000000000000000000000000000000000000000000"
    );
  } catch {
    return [];
  }
}

// ─── Fetch token metadata for unknown tokens ──────────────────────────────────
async function fetchTokenMeta(
  address: string
): Promise<{ symbol: string; name: string; decimals: number } | null> {
  if (!ALCHEMY_KEY) return null;
  try {
    const res = await fetch(ALCHEMY_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "alchemy_getTokenMetadata",
        params: [address],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const r = data.result;
    if (!r || !r.symbol) return null;
    return {
      symbol: r.symbol ?? "???",
      name: r.name ?? "Unknown Token",
      decimals: r.decimals ?? 18,
    };
  } catch {
    return null;
  }
}

// Generate consistent avatar colors from address
function addressToColor(addr: string): string {
  const colors = [
    "#6366F1","#8B5CF6","#EC4899","#EF4444","#F59E0B",
    "#10B981","#06B6D4","#3B82F6","#84CC16","#F97316",
  ];
  const n = parseInt(addr.slice(2, 8), 16);
  return colors[n % colors.length];
}

export function useTokenBalances() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!address || !publicClient) return;
    setLoading(true);
    setError(null);

    try {
      let tokenList: TokenInfo[] = [...KNOWN_TOKENS];

      // ─── 1. Try Alchemy for full discovery ──────────────────────────────
      if (ALCHEMY_KEY) {
        const alchemyTokens = await fetchAlchemyTokens(address);
        
        // Filter out tokens already in KNOWN_TOKENS
        const unknownAt = alchemyTokens.filter(at => {
          const addr = at.contractAddress.toLowerCase();
          return !KNOWN_TOKENS.some(k => k.address.toLowerCase() === addr);
        });

        // Fetch metadata in parallel (limited batch if needed, but for now all at once)
        const metaResults = await Promise.all(
          unknownAt.map(at => fetchTokenMeta(at.contractAddress))
        );

        metaResults.forEach((meta, idx) => {
          if (meta) {
            const at = unknownAt[idx];
            tokenList.push({
              address: at.contractAddress as `0x${string}`,
              symbol: meta.symbol,
              name: meta.name,
              decimals: meta.decimals,
              logoColor: addressToColor(at.contractAddress),
              logoLetter: meta.symbol[0]?.toUpperCase() ?? "?",
            } as TokenInfo & { isUnknown: true });
          }
        });
      }

      // ─── 2. Fetch all balances via Multicall3 ────────────────────────────
      const balanceCalls = tokenList.map((token) => ({
        target: token.address as Address,
        allowFailure: true,
        callData: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address],
        }),
      }));

      const results = await publicClient.readContract({
        address: MULTICALL3_ADDRESS,
        abi: MULTICALL3_ABI,
        functionName: "aggregate3",
        args: [balanceCalls],
      });

      // ─── 3. Fetch USD prices from GeckoTerminal (Best for Base Tokens) ──
      const tokenAddresses = tokenList.map((t) => t.address.toLowerCase()).join(",");

      let prices: Record<string, { price: number }> = {};
      
      // a) Try GeckoTerminal first
      if (tokenAddresses) {
        try {
          const priceRes = await fetch(
            `https://api.geckoterminal.com/api/v2/networks/base/tokens/multi/${tokenAddresses}`
          );
          if (priceRes.ok) {
            const data = await priceRes.json();
            (data.data || []).forEach((item: any) => {
              const addr = item.attributes.address.toLowerCase();
              prices[addr] = {
                price: parseFloat(item.attributes.price_usd || "0"),
              };
            });
          }
        } catch (err) {
          console.error("GeckoTerminal fetch failed:", err);
        }
      }

      // b) Fallback to LlamaPrice for missing prices
      const missingAddresses = tokenList
        .filter(t => !prices[t.address.toLowerCase()] || prices[t.address.toLowerCase()].price === 0)
        .map(t => `base:${t.address.toLowerCase()}`)
        .join(",");

      if (missingAddresses) {
        try {
          const llamaRes = await fetch(`https://coins.llama.fi/prices/current/${missingAddresses}`);
          if (llamaRes.ok) {
            const llamaData = await llamaRes.json();
            Object.entries(llamaData.coins || {}).forEach(([key, val]: [string, any]) => {
              const addr = key.split(":")[1].toLowerCase();
              prices[addr] = { price: val.price || 0 };
            });
          }
        } catch (err) {
          console.error("LlamaPrice fallback failed:", err);
        }
      }

      // ─── 4. Combine results ──────────────────────────────────────────────
      const tokenBalances: TokenBalance[] = [];

      tokenList.forEach((token, i) => {
        const result = (
          results as Array<{ success: boolean; returnData: `0x${string}` }>
        )[i];
        if (!result?.success) return;

        let balance = 0n;
        try {
          const decoded = decodeFunctionResult({
            abi: ERC20_ABI,
            functionName: "balanceOf",
            data: result.returnData,
          });
          balance = decoded as bigint;
        } catch {
          return;
        }

        if (balance === 0n) return; // skip zero balance

        const balanceFormatted = Number(balance) / Math.pow(10, token.decimals);
        
        // Get price from GeckoTerminal map
        const usdPrice = prices[token.address.toLowerCase()]?.price || 0;
        const usdValue = balanceFormatted * usdPrice;

        tokenBalances.push({
          ...token,
          balance,
          balanceFormatted,
          usdPrice,
          usdValue,
          canSell: !UNSELLABLE.has(token.address.toLowerCase()),
        });
      });

      // ─── 5. Sort: by USD value descending, then by symbol ────────────────
      tokenBalances.sort((a, b) => {
        if (b.usdValue !== a.usdValue) return b.usdValue - a.usdValue;
        return a.symbol.localeCompare(b.symbol);
      });

      setTokens(tokenBalances);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch balances");
    } finally {
      setLoading(false);
    }
  }, [address, publicClient]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  const totalUSDValue = tokens.reduce((s, t) => s + t.usdValue, 0);
  const dustTokens = tokens.filter(
    (t) => t.usdValue < 1 && t.usdValue > 0 && t.canSell
  );
  const deadTokens = tokens.filter(
    (t) => t.usdValue === 0 && t.balance > 0n
  );

  return {
    tokens,
    loading,
    error,
    refetch: fetchBalances,
    totalUSDValue,
    dustTokens,
    deadTokens,
  };
}
