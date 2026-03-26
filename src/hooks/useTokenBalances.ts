// src/hooks/useTokenBalances.ts
import { useEffect, useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { KNOWN_TOKENS, UNSELLABLE } from "@/lib/tokens";
import { scanTokens, type ScannedToken } from "@/lib/scanner";
import { type Address } from "viem";

export interface TokenBalance extends ScannedToken {
  balanceFormatted: number;
  logoUrl?: string;
  canSell: boolean;
}

export function useTokenBalances() {
  const { address } = useAccount();
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);

    try {
      const knownAddresses = KNOWN_TOKENS.map(t => t.address);
      const results = await scanTokens(address, knownAddresses);

      const mapped: TokenBalance[] = results.map(t => ({
        ...t,
        balanceFormatted: Number(t.balance) / Math.pow(10, t.decimals),
        logoUrl: `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/${t.address}/logo.png`,
        canSell: !UNSELLABLE.has(t.address.toLowerCase()),
      }));

      // Sort: by USD value descending
      mapped.sort((a, b) => b.usdValue - a.usdValue);

      setTokens(mapped);
    } catch (e) {
      console.error("Fetch Balances Error:", e);
      setError(e instanceof Error ? e.message : "Failed to fetch balances");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (address) {
      fetchBalances();
    }
  }, [address, fetchBalances]);

  const totalUSDValue = tokens.reduce((s, t) => s + t.usdValue, 0);
  const dustTokens = tokens.filter(
    (t) => t.usdValue < 1 && t.usdValue > 0 && t.canSell
  );
  const unpricedTokens = tokens.filter(
    (t) => t.status !== "PRICED" && t.balance > 0n && t.canSell
  );

  return {
    tokens,
    loading,
    error,
    refetch: fetchBalances,
    totalUSDValue,
    dustTokens,
    unpricedTokens,
    deadTokens: unpricedTokens,
  };
}

