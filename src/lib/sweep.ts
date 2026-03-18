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
  TOKENS,
  ERC20_ABI,
  FEE_RECIPIENT,
  PROTOCOL_FEE_BPS,
  BURN_ADDRESS,
  MIN_SWAP_VALUE_USDC,
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
        
        // 0x Aggregator - Finds best price across all DEXs on Base
        const quote = await get0xQuote(
          token.address,
          TOKENS.USDC,
          amountAfterFee.toString(),
          taker
        );

        const amountOut = BigInt(quote.buyAmount);

        // Even if GeckoTerminal says 0, if 0x can find a route for > MIN, it's a sell!
        if (amountOut === BigInt(0) || amountOut < MIN_SWAP_VALUE_USDC) {
          burnQuotes.push({ token, action: "burn", amountIn: token.balance });
          return;
        }

        const totalFeeAmount = (amountOut * PROTOCOL_FEE_BPS) / BigInt(10000);
        const { referrerBps, protocolBps } = splitFee(PROTOCOL_FEE_BPS, hasReferrer);

        const protocolFee = (amountOut * protocolBps) / BigInt(10000);
        const referrerFee = hasReferrer
          ? (amountOut * referrerBps) / BigInt(10000)
          : BigInt(0);
        const userReceives = amountOut - totalFeeAmount;
        
        const amountOutMinimum = BigInt(quote.minBuyAmount || 0);

        sellQuotes.push({
          token,
          action: "sell",
          amountIn: token.balance,
          estimatedOut: amountOut,
          protocolFee,
          referrerFee,
          userReceives,
          amountOutMinimum,
          tx: {
            to: quote.to as Address,
            data: quote.data as `0x${string}`,
            value: BigInt(quote.value || 0),
          },
        });
      } catch (err) {
        // Log error but don't mark as burn if it's a known high-value token
        // If 0x fail for any reason, we assume it's a burn (no liquidity / unswappable)
        // unless it has significant USD value from GeckoTerminal, then it's a technical error.
        if (token.usdValue < 0.01) {
          burnQuotes.push({ token, action: "burn", amountIn: token.balance });
        } else {
          console.error(`0x Quote failed for ${token.symbol} (${token.usdValue} USD):`, err);
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
