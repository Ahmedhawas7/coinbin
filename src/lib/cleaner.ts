// src/lib/cleaner.ts
import { scanTokens, type ScannedToken } from "./scanner";
import { buildSwap, type SwapInstance } from "./swap";
import { executeBatchSell, type BatchProgress } from "./batchSell";
import { ethers } from "ethers";

export interface CleanerConfig {
  account: string;
  tokenAddresses?: string[];
  slippage?: number;
}

export class CleanerEngine {
  private config: CleanerConfig;

  constructor(config: CleanerConfig) {
    this.config = config;
  }

  async scan(): Promise<ScannedToken[]> {
    return await scanTokens(this.config.account);
  }

  async prepareSwaps(tokens: ScannedToken[]): Promise<SwapInstance[]> {
    const swaps: SwapInstance[] = [];
    for (const token of tokens) {
      if (token.status === "PRICED" || token.status === "HIDDEN") {
        const swap = await buildSwap(
          token.address,
          token.symbol,
          token.balance,
          this.config.account,
          this.config.slippage
        );
        swaps.push(swap);
      } else if (token.status === "NO_LIQUIDITY") {
         // Mark for burn (no quote)
         swaps.push({
           tokenAddress: token.address,
           symbol: token.symbol,
           amountIn: token.balance,
           quote: null
         });
      }
    }
    return swaps;
  }

  async clean(
    signer: ethers.Signer,
    swaps: SwapInstance[],
    onProgress: (p: BatchProgress) => void
  ) {
    await executeBatchSell(signer, swaps, onProgress);
  }
}
