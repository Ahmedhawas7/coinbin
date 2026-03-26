// src/lib/batchSell.ts
import { ethers } from "ethers";
import { ERC20_ABI, BURN_ADDRESS } from "@/config/contracts";
import { type SwapInstance } from "./swap";

export interface BatchProgress {
  total: number;
  current: number;
  status: string;
  errors: string[];
  sellTxHash?: string;
  burnTxHashes?: `0x${string}`[];
}

export async function executeBatchSell(
  signer: ethers.Signer,
  swaps: SwapInstance[],
  onProgress: (progress: BatchProgress) => void
) {
  const errors: string[] = [];
  const burnTxHashes: `0x${string}`[] = [];
  let sellTxHash: string | undefined;
  const total = swaps.length;

  for (let i = 0; i < total; i++) {
    const swap = swaps[i];
    onProgress({ total, current: i + 1, status: `Processing ${swap.symbol}...`, errors, sellTxHash, burnTxHashes });

    try {
      if (swap.quote) {
        // Handle Approval if needed
        const token = new ethers.Contract(swap.tokenAddress, ERC20_ABI, signer);
        const address = await signer.getAddress();
        const allowance = await token.allowance(address, swap.quote.allowanceTarget);
        
        if (BigInt(allowance) < swap.amountIn) {
          const approveTx = await token.approve(swap.quote.allowanceTarget, ethers.MaxUint256);
          await approveTx.wait();
        }

        // Execute Swap
        const tx = await signer.sendTransaction({
          to: swap.quote.to,
          data: swap.quote.data,
          value: swap.quote.value,
        });
        sellTxHash = tx.hash;
        await tx.wait();
      } else {
        // Fallback: Burn
        const token = new ethers.Contract(swap.tokenAddress, ERC20_ABI, signer);
        const tx = await token.transfer(BURN_ADDRESS, swap.amountIn);
        burnTxHashes.push(tx.hash as `0x${string}`);
        await tx.wait();
      }
    } catch (e: any) {
      console.error(`Error processing ${swap.symbol}:`, e);
      errors.push(`${swap.symbol}: ${e.message || "Unknown error"}`);
    }
  }

  onProgress({ total, current: total, status: "Batch Complete", errors, sellTxHash, burnTxHashes });
}
