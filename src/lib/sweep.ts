// src/lib/sweep.ts — CoinBin Core Engine
//
// طبقات العمل:
//  1. SELL   → توكنات بسيولة → بيع عبر Uniswap V3
//  2. BURN   → توكنات ميتة → transfer إلى 0xdead
//  3. FEES   → 0.3% من كل بيع → FEE_RECIPIENT
//  4. REFERRAL → 20% من الرسوم → المُحيل (إن وجد)

import {
  encodeFunctionData,
  maxUint256,
  type Address,
  type PublicClient,
  type WalletClient,
} from "viem";
import {
  UNISWAP_V3_ROUTER,
  UNISWAP_V3_QUOTER,
  QUOTER_ABI,
  SWAP_ROUTER_ABI,
  TOKENS,
  ERC20_ABI,
  FEE_RECIPIENT,
  PROTOCOL_FEE_BPS,
  BURN_ADDRESS,
  MIN_SWAP_VALUE_USDC,
  AERODROME_ROUTER,
  AERODROME_ROUTER_ABI,
} from "@/config/contracts";
import { splitFee } from "@/lib/referral";
import { get0xQuote } from "@/lib/zerox";
import { UNSELLABLE } from "@/lib/tokens";


// ─── Types ───────────────────────────────────────────────────────────────────

export type TokenAction = "sell" | "burn" | "skip";

export interface TokenToProcess {
  address: Address;
  symbol: string;
  balance: bigint;
  decimals: number;
  usdValue: number;
}

export interface SweepQuote {
  token: TokenToProcess;
  action: TokenAction;
  amountIn: bigint;
  amountOutMinimum?: bigint;
  estimatedOut?: bigint;
  protocolFee?: bigint;
  referrerFee?: bigint;
  userReceives?: bigint;
  tx?: {
    to: Address;
    data: `0x${string}`;
    value: bigint;
  };
}


export interface SweepResult {
  sellQuotes: SweepQuote[];
  burnQuotes: SweepQuote[];
  totalEstimatedUSDC: bigint;
  totalAfterFee: bigint;
  totalProtocolFee: bigint;
  totalProtocolFeeUSD: number;
  referrer?: Address;
}

// findBestFeeTier removed in favor of 0x aggregator


// ─── 2. Classify tokens: sell vs burn ────────────────────────────────────────

export async function classifyTokens(
  publicClient: PublicClient,
  tokens: TokenToProcess[],
  slippageBps: number,
  taker: Address,
  referrer?: Address
): Promise<SweepResult> {
  const sellQuotes: SweepQuote[] = [];
  const burnQuotes: SweepQuote[] = [];

  const hasReferrer = !!referrer;

  await Promise.all(
    tokens.map(async (token) => {
      // ─── a) Skip USDC/USDbC (Target Asset) ──────────────────────────────────
      if (UNSELLABLE.has(token.address.toLowerCase())) {
        return; // Just ignore, don't add to sell or burn
      }

      try {
        const amountAfterFee = token.balance - (token.balance * PROTOCOL_FEE_BPS) / BigInt(10000);
        
        // 1. Try 0x Aggregator (Best)
        let quote: any;
        try {
          quote = await get0xQuote(
            token.address,
            TOKENS.USDC,
            amountAfterFee.toString(),
            taker
          );
          
          if (quote && quote.buyAmount && BigInt(quote.buyAmount) >= MIN_SWAP_VALUE_USDC) {
            const amountOut = BigInt(quote.buyAmount);
            const totalFeeAmount = (amountOut * PROTOCOL_FEE_BPS) / BigInt(10000);
            const { referrerBps, protocolBps } = splitFee(PROTOCOL_FEE_BPS, hasReferrer);
            const protocolFee = (amountOut * protocolBps) / BigInt(10000);
            const referrerFee = hasReferrer ? (amountOut * referrerBps) / BigInt(10000) : BigInt(0);
            const userReceives = amountOut - totalFeeAmount;
            
            sellQuotes.push({
              token,
              action: "sell",
              amountIn: token.balance,
              estimatedOut: amountOut,
              protocolFee,
              referrerFee,
              userReceives,
              amountOutMinimum: BigInt(quote.minBuyAmount || 0),
              tx: {
                to: quote.to as Address,
                data: quote.data as `0x${string}`,
                value: BigInt(quote.value || 0),
              },
            });
            return;
          }
        } catch (err) {
          console.warn(`0x failed for ${token.symbol}, trying DEX fallbacks...`);
        }

        // 2. Try Aerodrome (Base Native #1 DEX)
        try {
          // Routes to check: [Direct, WETH Routed]
          const routeOptions = [
            [{ from: token.address, to: TOKENS.USDC, stable: false }],
            [
              { from: token.address, to: TOKENS.WETH, stable: false },
              { from: TOKENS.WETH, to: TOKENS.USDC, stable: false }
            ]
          ];

          let bestAeroOut = BigInt(0);
          let bestAeroRoute: any[] = [];

          for (const routes of routeOptions) {
            try {
              const amounts = await publicClient.readContract({
                address: AERODROME_ROUTER,
                abi: AERODROME_ROUTER_ABI,
                functionName: "getAmountsOut",
                args: [amountAfterFee, routes],
              });
              const out = (amounts as bigint[])[(amounts as bigint[]).length - 1];
              if (out > bestAeroOut) {
                bestAeroOut = out;
                bestAeroRoute = routes;
              }
            } catch {}
          }

          if (bestAeroOut >= MIN_SWAP_VALUE_USDC) {
            const totalFeeAmount = (bestAeroOut * PROTOCOL_FEE_BPS) / BigInt(10000);
            const { referrerBps, protocolBps } = splitFee(PROTOCOL_FEE_BPS, hasReferrer);
            const protocolFee = (bestAeroOut * protocolBps) / BigInt(10000);
            const referrerFee = hasReferrer ? (bestAeroOut * referrerBps) / BigInt(10000) : BigInt(0);
            const userReceives = bestAeroOut - totalFeeAmount;

            sellQuotes.push({
              token,
              action: "sell",
              amountIn: token.balance,
              estimatedOut: bestAeroOut,
              protocolFee,
              referrerFee,
              userReceives,
              amountOutMinimum: (bestAeroOut * BigInt(95)) / BigInt(100), // 5% slippage
              tx: {
                to: AERODROME_ROUTER,
                data: encodeFunctionData({
                  abi: AERODROME_ROUTER_ABI,
                  functionName: "swapExactTokensForTokens",
                  args: [
                    amountAfterFee,
                    (bestAeroOut * BigInt(95)) / BigInt(100),
                    bestAeroRoute,
                    taker,
                    BigInt(Math.floor(Date.now() / 1000) + 1200), // 20 min deadline
                  ],
                }),
                value: BigInt(0),
              },
            });
            return;
          }
        } catch (aeroErr) {
          console.warn(`Aerodrome fallback failed for ${token.symbol}`);
        }

        // 3. Try Uniswap V3 (Final DEX Fallback)
        try {
          const tiers = [3000, 10000, 500, 100];
          let bestUniOut = BigInt(0);
          let bestUniTier = 3000;

          for (const tier of tiers) {
            try {
              const out = await publicClient.readContract({
                address: UNISWAP_V3_QUOTER,
                abi: QUOTER_ABI,
                functionName: "quoteExactInputSingle",
                args: [{
                  tokenIn: token.address,
                  tokenOut: TOKENS.USDC,
                  amountIn: amountAfterFee,
                  fee: tier,
                  sqrtPriceLimitX96: BigInt(0),
                }],
              });
              const amount = (out as any)[0] as bigint;
              if (amount > bestUniOut) {
                bestUniOut = amount;
                bestUniTier = tier;
              }
            } catch {}
          }

          if (bestUniOut >= MIN_SWAP_VALUE_USDC) {
            const totalFeeAmount = (bestUniOut * PROTOCOL_FEE_BPS) / BigInt(10000);
            const { referrerBps, protocolBps } = splitFee(PROTOCOL_FEE_BPS, hasReferrer);
            const protocolFee = (bestUniOut * protocolBps) / BigInt(10000);
            const referrerFee = hasReferrer ? (bestUniOut * referrerBps) / BigInt(10000) : BigInt(0);
            const userReceives = bestUniOut - totalFeeAmount;

            sellQuotes.push({
              token,
              action: "sell",
              amountIn: token.balance,
              estimatedOut: bestUniOut,
              protocolFee,
              referrerFee,
              userReceives,
              amountOutMinimum: (bestUniOut * BigInt(95)) / BigInt(100),
              tx: {
                to: UNISWAP_V3_ROUTER,
                data: encodeFunctionData({
                  abi: SWAP_ROUTER_ABI,
                  functionName: "exactInputSingle",
                  args: [{
                    tokenIn: token.address,
                    tokenOut: TOKENS.USDC,
                    fee: bestUniTier,
                    recipient: taker,
                    amountIn: amountAfterFee,
                    amountOutMinimum: (bestUniOut * BigInt(95)) / BigInt(100),
                    sqrtPriceLimitX96: BigInt(0),
                  }],
                }),
                value: BigInt(0),
              },
            });
            return;
          }
        } catch (uniErr) {
          console.warn(`Uniswap V3 fallback failed for ${token.symbol}`);
        }

        // 4. If all fail, mark as burn or skip based on real value
        if (token.usdValue < 0.01) {
          burnQuotes.push({ token, action: "burn", amountIn: token.balance });
        } else {
          console.warn(`[Sweep] Skipping ${token.symbol} (${token.usdValue} USD): Could not find sufficient swap route.`);
        }
      } catch (err) {
        // Log error but don't mark as burn if it's a known high-value token
        // If 0x fail for any reason, we assume it's a burn (no liquidity / unswappable)
        // unless it has significant USD value from DexScreener/GeckoTerminal, then it's a technical error.
        if (token.usdValue < 0.01) {
          burnQuotes.push({ token, action: "burn", amountIn: token.balance });
        } else {
          console.error(`Swap evaluation failed for ${token.symbol} (${token.usdValue} USD):`, err);
        }
      }
    })
  );

  const totalEstimatedUSDC = sellQuotes.reduce((s, q) => s + (q.estimatedOut ?? BigInt(0)), BigInt(0));
  const totalProtocolFee = sellQuotes.reduce((s, q) => s + (q.protocolFee ?? BigInt(0)), BigInt(0));
  const totalAfterFee = sellQuotes.reduce((s, q) => s + (q.userReceives ?? BigInt(0)), BigInt(0));

  return {
    sellQuotes,
    burnQuotes,
    totalEstimatedUSDC,
    totalAfterFee,
    totalProtocolFee,
    totalProtocolFeeUSD: Number(totalProtocolFee) / 1e6,
    referrer,
  };
}

// ─── 3. Check & get approvals ─────────────────────────────────────────────────

export async function checkApprovals(
  publicClient: PublicClient,
  owner: Address,
  tokens: { address: Address; balance: bigint; spender?: Address }[]
): Promise<{ tokenAddress: Address; spender: Address }[]> {
  const needsApproval: { tokenAddress: Address; spender: Address }[] = [];
  await Promise.all(
    tokens.map(async (token) => {
      const spender = token.spender || UNISWAP_V3_ROUTER;
      try {
        const allowance = await publicClient.readContract({
          address: token.address,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [owner, spender],
        });

        if ((allowance as bigint) < token.balance) {
          needsApproval.push({ tokenAddress: token.address, spender });
        }
      } catch {
        needsApproval.push({ tokenAddress: token.address, spender });
      }
    })
  );
  return needsApproval;
}

export async function approveToken(
  walletClient: WalletClient,
  tokenAddress: Address,
  spender: Address,
  account: Address
): Promise<`0x${string}`> {
  return walletClient.writeContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [spender, maxUint256],
    account,
    chain: walletClient.chain,
  });
}

// ─── 4. Execute SELL ─────────────────────────────────────────────────────────

export async function executeSell(
  walletClient: WalletClient,
  publicClient: PublicClient,
  quote: SweepQuote,
  recipient: Address
): Promise<`0x${string}`> {
  if (!quote.tx) throw new Error(`Missing TX data for ${quote.token.symbol}`);

  return walletClient.sendTransaction({
    to: quote.tx.to,
    data: quote.tx.data,
    value: quote.tx.value,
    account: recipient,
    chain: walletClient.chain,
  });
}


// ─── 5. Execute BURN ─────────────────────────────────────────────────────────

export async function executeBurn(
  walletClient: WalletClient,
  quotes: SweepQuote[],
  sender: Address
): Promise<`0x${string}`[]> {
  if (quotes.length === 0) return [];
  const hashes: `0x${string}`[] = [];

  for (const q of quotes) {
    try {
      const hash = await walletClient.writeContract({
        address: q.token.address,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [BURN_ADDRESS, q.amountIn],
        account: sender,
        chain: walletClient.chain,
      });
      hashes.push(hash);
    } catch (err) {
      console.error(`Failed to burn ${q.token.symbol}:`, err);
    }
  }
  return hashes;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatUSDC(raw: bigint): string {
  const n = Number(raw) / 1e6;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (n >= 0.01) return `$${n.toFixed(2)}`;
  if (n > 0) return `$${n.toFixed(6)}`;
  return "$0.00";
}

export function calcProtocolFeeUSD(usdValue: number): number {
  return usdValue * (Number(PROTOCOL_FEE_BPS) / 10000);
}
