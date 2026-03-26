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
    const BATCH_SIZE = 5;

    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (token) => {
        if (token.status === "PRICED" || token.status === "HIDDEN") {
          return await buildSwap(
            token.address,
            token.symbol,
            token.balance,
            this.config.account,
            this.config.slippage
          );
        } else if (token.status === "NO_LIQUIDITY") {
          return {
            tokenAddress: token.address,
            symbol: token.symbol,
            amountIn: token.balance,
            quote: null
          };
        }
        return null;
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(res => {
        if (res) swaps.push(res);
      });
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
