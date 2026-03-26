// src/hooks/useTokenBalances.ts
import { useEffect, useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { UNSELLABLE } from "@/lib/tokens";
import { scanTokens, type ScannedToken } from "@/lib/scanner";

export interface TokenBalance extends ScannedToken {
  balanceFormatted: number;
  logoUrl?: string;
  canSell: boolean;
}

export function useTokenBalances() {
  const { address, isConnected } = useAccount();
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);

    try {
      console.log(`[useTokenBalances] 🚀 Orchestrating scan for ${address}`);
      const results = await scanTokens(address);
      
      console.log(`[useTokenBalances] 📊 Discovered ${results.length} tokens with positive balance.`);

      const mapped: TokenBalance[] = results.map(t => ({
        ...t,
        balanceFormatted: Number(t.balance) / Math.pow(10, t.decimals),
        logoUrl: `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/${t.address}/logo.png`,
        canSell: !UNSELLABLE.has(t.address.toLowerCase()),
      }));

      // Sort: by USD value descending, then by PRICED status
      mapped.sort((a, b) => {
        if (a.status === "PRICED" && b.status !== "PRICED") return -1;
        if (a.status !== "PRICED" && b.status === "PRICED") return 1;
        return b.usdValue - a.usdValue;
      });

      console.log(`[useTokenBalances] ✅ UI update with ${mapped.length} tokens.`);
      setTokens(mapped);
    } catch (e) {
      console.error("[useTokenBalances] Scan Orchestration Error:", e);
      setError(e instanceof Error ? e.message : "Failed to fetch balances");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (isConnected && address) {
      fetchBalances();
    }
  }, [isConnected, address, fetchBalances]);

  // Wallet Total = sum of PRICED tokens
  const totalUSDValue = tokens
    .filter(t => t.status === "PRICED")
    .reduce((s, t) => s + t.usdValue, 0);

  const dustTokens = tokens.filter(
    (t) => t.status === "PRICED" && t.usdValue < 1 && t.usdValue > 0 && t.canSell
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

