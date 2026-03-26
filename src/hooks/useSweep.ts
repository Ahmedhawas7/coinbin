// src/hooks/useSweep.ts
import { useState, useCallback, useMemo } from "react";
import { useAccount } from "wagmi";
import { ethers } from "ethers";
import { CleanerEngine } from "@/lib/cleaner";
import { type ScannedToken } from "@/lib/scanner";
import { type BatchProgress } from "@/lib/batchSell";
import { type SwapInstance } from "@/lib/swap";

export type SweepStatus = "idle" | "scanning" | "preparing" | "cleaning" | "success" | "error";

export interface SweepState {
  status: SweepStatus;
  currentStep: string;
  scannedTokens: ScannedToken[];
  swaps: SwapInstance[];
  progress: BatchProgress | null;
  error?: string;
}

const INITIAL: SweepState = {
  status: "idle",
  currentStep: "",
  scannedTokens: [],
  swaps: [],
  progress: null,
};

export function useSweep() {
  const { address } = useAccount();
  const [state, setState] = useState<SweepState>(INITIAL);

  const patch = (p: Partial<SweepState>) =>
    setState((prev) => ({ ...prev, ...p }));

  const scan = useCallback(async (tokenAddresses: string[]) => {
    if (!address) return;
    patch({ status: "scanning", currentStep: "Scanning on-chain liquidity..." });
    try {
      const engine = new CleanerEngine({ account: address as string, tokenAddresses });
      const results = await engine.scan();
      patch({ status: "idle", scannedTokens: results, currentStep: "" });
      return results;
    } catch (e: any) {
      patch({ status: "error", error: e.message });
      return [];
    }
  }, [address]);

  const startCleaning = useCallback(async (tokens: ScannedToken[], slippage?: number) => {
    if (!address || typeof window === "undefined" || !(window as any).ethereum) return;
    
    patch({ status: "preparing", currentStep: "Preparing swap routes..." });
    
    try {
      const engine = new CleanerEngine({ 
        account: address as string, 
        tokenAddresses: tokens.map(t => t.address),
        slippage 
      });
      
      const swaps = await engine.prepareSwaps(tokens);
      patch({ status: "cleaning", swaps, currentStep: "Executing batch..." });

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();

      await engine.clean(signer, swaps, (progress) => {
        patch({ progress, currentStep: progress.status });
      });

      patch({ status: "success", currentStep: "Cleaning Complete!" });
    } catch (e: any) {
      console.error("Cleaning Error:", e);
      patch({ status: "error", error: e.message || "Batch execution failed" });
    }
  }, [address]);

  const reset = useCallback(() => setState(INITIAL), []);

  const totalValue = useMemo(() => {
    return state.scannedTokens.reduce((acc, t) => acc + t.usdValue, 0);
  }, [state.scannedTokens]);

  return {
    state,
    scan,
    startCleaning,
    reset,
    totalValue,
  };
}

