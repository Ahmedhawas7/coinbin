// src/hooks/useSweep.ts — CoinBin State Machine
//
// مراحل التنفيذ:
//   idle → classifying → approving → selling → burning → success | error

import { useState, useCallback } from "react";
import { usePublicClient, useWalletClient, useAccount } from "wagmi";
import {
  classifyTokens,
  checkApprovals,
  approveToken,
  executeSell,
  executeBurn,
  formatUSDC,
  type TokenToProcess,
  type SweepResult,
} from "@/lib/sweep";
import type { Address } from "viem";

export type SweepStatus =
  | "idle"
  | "classifying"
  | "approving"
  | "selling"
  | "burning"
  | "success"
  | "error";

export interface SweepState {
  status: SweepStatus;
  currentStep: string;
  sweepResult: SweepResult | null;
  sellCount: number;
  burnCount: number;
  approvalsNeeded: number;
  approvalsComplete: number;
  sellTxHash?: `0x${string}`;
  burnTxHashes?: `0x${string}`[];
  error?: string;
  formattedUserReceives: string;
  formattedProtocolFee: string;
  protocolFeeUSD: number;
}

const INITIAL: SweepState = {
  status: "idle",
  currentStep: "",
  sweepResult: null,
  sellCount: 0,
  burnCount: 0,
  approvalsNeeded: 0,
  approvalsComplete: 0,
  formattedUserReceives: "$0.00",
  formattedProtocolFee: "$0.0000",
  protocolFeeUSD: 0,
};

export function useSweep() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [state, setState] = useState<SweepState>(INITIAL);

  const patch = (p: Partial<SweepState>) =>
    setState((prev) => ({ ...prev, ...p }));

  // ─── Step 1: Classify (sell vs burn) ─────────────────────────────────────
  const classify = useCallback(
    async (tokens: TokenToProcess[], slippageBps: number, referrer?: Address) => {
      if (!publicClient || !address) return null;

      patch({ status: "classifying", currentStep: "🔍 تحليل الأسعار عبر Uniswap..." });

      try {
        const result = await classifyTokens(publicClient, tokens, slippageBps, referrer);

        patch({
          status: "idle",
          sweepResult: result,
          sellCount: result.sellQuotes.length,
          burnCount: result.burnQuotes.length,
          formattedUserReceives: formatUSDC(result.totalAfterFee),
          formattedProtocolFee: `$${result.totalProtocolFeeUSD.toFixed(4)}`,
          protocolFeeUSD: result.totalProtocolFeeUSD,
          currentStep: "",
        });

        return result;
      } catch (e) {
        patch({
          status: "error",
          error: e instanceof Error ? e.message : "فشل تحليل التوكنات",
          currentStep: "",
        });
        return null;
      }
    },
    [publicClient, address]
  );

  // ─── Step 2: Execute sell + burn ─────────────────────────────────────────
  const execute = useCallback(
    async (result: SweepResult, slippageBps: number) => {
      if (!publicClient || !walletClient || !address) {
        patch({ status: "error", error: "المحفظة غير متصلة" });
        return;
      }

      try {
        // ── a) Approvals ──────────────────────────────────────────────────
        if (result.sellQuotes.length > 0) {
          patch({ status: "approving", currentStep: "التحقق من الصلاحيات..." });

          const needApproval = await checkApprovals(
            publicClient,
            address,
            result.sellQuotes.map((q) => q.token)
          );

          patch({ approvalsNeeded: needApproval.length, approvalsComplete: 0 });

          for (let i = 0; i < needApproval.length; i++) {
            const tokenAddr = needApproval[i];
            const sym =
              result.sellQuotes.find(
                (q) => q.token.address.toLowerCase() === tokenAddr.toLowerCase()
              )?.token.symbol ?? "...";

            patch({ currentStep: `موافقة على ${sym} (${i + 1}/${needApproval.length})` });

            const tx = await approveToken(walletClient, tokenAddr, address);
            await publicClient.waitForTransactionReceipt({ hash: tx });
            patch({ approvalsComplete: i + 1 });
          }
        }

        // ── b) Sell ───────────────────────────────────────────────────────
        let sellTxHash: `0x${string}` | undefined;
        if (result.sellQuotes.length > 0) {
          patch({
            status: "selling",
            currentStep: `💰 بيع ${result.sellQuotes.length} رمز → USDC...`,
          });

          sellTxHash = await executeSell(
            walletClient,
            publicClient,
            result.sellQuotes,
            address,
            result.referrer
          );
          await publicClient.waitForTransactionReceipt({ hash: sellTxHash });
        }

        // ── c) Burn ───────────────────────────────────────────────────────
        let burnHashes: `0x${string}`[] = [];
        if (result.burnQuotes.length > 0) {
          patch({
            status: "burning",
            currentStep: `🔥 حرق ${result.burnQuotes.length} رمز ميت...`,
          });

          burnHashes = await executeBurn(walletClient, result.burnQuotes, address);
          if (burnHashes.length > 0) {
            await publicClient.waitForTransactionReceipt({
              hash: burnHashes[burnHashes.length - 1],
            });
          }
        }

        patch({
          status: "success",
          sellTxHash,
          burnTxHashes: burnHashes,
          currentStep: "✅ اكتمل!",
        });
      } catch (e: unknown) {
        const msg =
          e instanceof Error
            ? e.message.includes("User rejected") || e.message.includes("denied")
              ? "تم إلغاء المعاملة من المحفظة"
              : e.message
            : "حدث خطأ غير متوقع";
        patch({ status: "error", error: msg, currentStep: "" });
      }
    },
    [publicClient, walletClient, address]
  );

  const reset = useCallback(() => setState(INITIAL), []);

  return { state, classify, execute, reset };
}
