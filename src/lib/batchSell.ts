// src/lib/batchSell.ts
import { ethers } from "ethers";
import { ERC20_ABI, BURN_ADDRESS, AERODROME_ROUTER_ABI, V2_ROUTER_ABI } from "@/config/contracts";
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
      const token = new ethers.Contract(swap.tokenAddress, ERC20_ABI, signer);
      const address = await signer.getAddress();
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 mins

      if (swap.quote) {
        // --- 0x Swap ---
        const allowance = await token.allowance(address, swap.quote.allowanceTarget);
        if (BigInt(allowance) < swap.amountIn) {
          const approveTx = await token.approve(swap.quote.allowanceTarget, ethers.MaxUint256);
          await approveTx.wait();
        }

        const tx = await signer.sendTransaction({
          to: swap.quote.to,
          data: swap.quote.data,
          value: swap.quote.value,
        });
        sellTxHash = tx.hash;
        await tx.wait();
      } else if (swap.dexQuote) {
        // --- DEX Fallback Swap (V2/Aero) ---
        const { router, path, amountOutMin, isAerodrome } = swap.dexQuote;
        
        // Handle Approval
        const allowance = await token.allowance(address, router);
        if (BigInt(allowance) < swap.amountIn) {
          const approveTx = await token.approve(router, ethers.MaxUint256);
          await approveTx.wait();
        }

        const routerContract = new ethers.Contract(router, isAerodrome ? AERODROME_ROUTER_ABI : V2_ROUTER_ABI, signer);
        
        let tx;
        if (isAerodrome) {
          const routes = [];
          for (let j = 0; j < path.length - 1; j++) {
            routes.push({ from: path[j], to: path[j+1], stable: false });
          }
          tx = await routerContract.swapExactTokensForTokens(swap.amountIn, amountOutMin, routes, address, deadline);
        } else {
          tx = await routerContract.swapExactTokensForTokens(swap.amountIn, amountOutMin, path, address, deadline);
        }
        
        sellTxHash = tx.hash;
        await tx.wait();
        console.log(`[Batch] ✅ DEX Swap executed for ${swap.symbol}`);
      } else {
        // --- Burn Fallback ---
        const tx = await token.transfer(BURN_ADDRESS, swap.amountIn);
        burnTxHashes.push(tx.hash as `0x${string}`);
        await tx.wait();
      }
    } catch (error) {
      const e = error as Error;
      console.error(`Error processing ${swap.symbol}:`, e);
      errors.push(`${swap.symbol}: ${e.message || "Unknown error"}`);
    }
  }

  onProgress({ total, current: total, status: "Batch Complete", errors, sellTxHash, burnTxHashes });
}
