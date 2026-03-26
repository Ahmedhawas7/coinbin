// src/hooks/useTokenBalances.ts
import { useEffect, useState, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import { KNOWN_TOKENS, UNSELLABLE, fetchBaseTokenList } from "@/lib/tokens";
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
  const hasFetchedList = useRef(false);
  const [baseAddresses, setBaseAddresses] = useState<string[]>([]);

  const fetchBalances = useCallback(async (customAddresses?: string[]) => {
    if (!address) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Prepare address list
      let addressesToScan: `0x${string}`[] = [...KNOWN_TOKENS.map(t => t.address)];
      
      if (customAddresses && customAddresses.length > 0) {
        addressesToScan = [...new Set([...addressesToScan, ...customAddresses as `0x${string}`[]])];
      } else if (baseAddresses.length > 0) {
        addressesToScan = [...new Set([...addressesToScan, ...baseAddresses as `0x${string}`[]])];
      }

      console.log(`[useTokenBalances] Scanning ${addressesToScan.length} unique addresses...`);

      // 2. Scan
      const results = await scanTokens(address, addressesToScan);
      console.log(`[useTokenBalances] Scan returned ${results.length} tokens with balance.`);

      // 3. Map to UI Model
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
      console.error("[useTokenBalances] Fetch Balances Error:", e);
      setError(e instanceof Error ? e.message : "Failed to fetch balances");
    } finally {
      setLoading(false);
    }
  }, [address, baseAddresses]);

  // Initial List Fetch
  useEffect(() => {
    if (isConnected && !hasFetchedList.current) {
      hasFetchedList.current = true;
      fetchBaseTokenList().then(list => {
        if (list.length > 0) {
          setBaseAddresses(list);
        }
      });
    }
  }, [isConnected]);

  // Initial Balance Fetch
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

