// src/lib/scanner.ts
import { ethers } from "ethers";
import { MULTICALL3_ADDRESS, MULTICALL3_ABI, ERC20_ABI, TOKENS } from "@/config/contracts";
import { discoverPools } from "./liquidity";
import { get0xPrice } from "./0x";
import { KNOWN_TOKENS, fetchBaseTokenList } from "./tokens";

const RPC_URL = "https://mainnet.base.org";
const provider = new ethers.JsonRpcProvider(RPC_URL);

export type LiquidityStatus = "PRICED" | "HIDDEN" | "NO_LIQUIDITY" | "DEAD";

export interface ScannedToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: bigint;
  usdValue: number;
  status: LiquidityStatus;
  price: number;
}

/**
 * PHASE 1: DISCOVERY
 * Finds potential token addresses for the wallet
 */
async function discoverAddresses(account: string): Promise<string[]> {
  const addresses = new Set<string>();

  // 1. Known Tokens
  KNOWN_TOKENS.forEach(t => addresses.add(t.address.toLowerCase()));

  // 2. Base Token List
  try {
    const baseList = await fetchBaseTokenList();
    baseList.forEach(addr => addresses.add(addr.toLowerCase()));
  } catch (e) {
    console.warn("[Scanner] Failed to fetch Base token list, continuing with known tokens.");
  }

  // 3. Transfer Logs (Last 10,000 blocks)
  try {
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - 10000;
    
    // Tokens transferred TO the user
    const toLogs = await provider.getLogs({
      fromBlock,
      toBlock: 'latest',
      topics: [
        ethers.id("Transfer(address,address,uint256)"),
        null,
        ethers.zeroPadValue(account, 32)
      ]
    });

    toLogs.forEach(log => addresses.add(log.address.toLowerCase()));
    console.log(`[Scanner] Discovery found ${toLogs.length} recent transfer logs.`);
  } catch (e) {
    console.warn("[Scanner] Log discovery failed, continuing...", e);
  }

  return Array.from(addresses);
}

/**
 * PHASE 2 & 3: SCAN & ENRICH
 */
export async function scanTokens(account: string): Promise<ScannedToken[]> {
  console.log(`[Scanner] Starting Wallet-First scan for ${account}`);
  
  // 1. Discovery
  const potentialAddresses = await discoverAddresses(account);
  console.log(`[Scanner] Discovery found ${potentialAddresses.length} potential tokens.`);

  // 2. Metadata & Balance (Multicall)
  const multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);
  const erc20 = new ethers.Interface(ERC20_ABI);
  
  const calls = [];
  for (const addr of potentialAddresses) {
    calls.push({ target: addr, allowFailure: true, callData: erc20.encodeFunctionData("balanceOf", [account]) });
    calls.push({ target: addr, allowFailure: true, callData: erc20.encodeFunctionData("decimals") });
    calls.push({ target: addr, allowFailure: true, callData: erc20.encodeFunctionData("symbol") });
    calls.push({ target: addr, allowFailure: true, callData: erc20.encodeFunctionData("name") });
  }

  // Process in chunks to avoid RPC limits
  const CHUNK_SIZE = 100;
  const results: any[] = [];
  for (let i = 0; i < calls.length; i += CHUNK_SIZE) {
    const chunk = calls.slice(i, i + CHUNK_SIZE);
    try {
      const chunkRes = await multicall.aggregate3(chunk);
      results.push(...chunkRes);
    } catch (e) {
      console.error(`[Scanner] Multicall chunk ${i} failed`, e);
      // Fill with failures
      results.push(...new Array(chunk.length).fill({ success: false, returnData: "0x" }));
    }
  }

  const discoveredTokens: ScannedToken[] = [];

  // Parse Multicall Results
  for (let i = 0; i < potentialAddresses.length; i++) {
    const addr = potentialAddresses[i];
    const resBase = i * 4;
    
    const balanceRes = results[resBase];
    const decimalsRes = results[resBase + 1];
    const symbolRes = results[resBase + 2];
    const nameRes = results[resBase + 3];

    if (!balanceRes?.success) continue;

    try {
      const balance = ethers.toBigInt(balanceRes.returnData);
      if (balance === 0n) continue;

      const decimals = decimalsRes?.success ? Number(ethers.toBigInt(decimalsRes.returnData)) : 18;
      const symbol = symbolRes?.success ? erc20.decodeFunctionResult("symbol", symbolRes.returnData)[0] : "???";
      const name = nameRes?.success ? erc20.decodeFunctionResult("name", nameRes.returnData)[0] : "Unknown Token";

      discoveredTokens.push({
        address: addr,
        symbol,
        name,
        decimals,
        balance,
        usdValue: 0,
        status: "NO_LIQUIDITY",
        price: 0
      });
    } catch (e) {}
  }

  console.log(`[Scanner] Found ${discoveredTokens.length} tokens with balance > 0. Starting enrichment...`);

  // 3. Enrichment (Sequential for 0x, can be parallel for others)
  const enrichedTokens: ScannedToken[] = [];
  
  for (const token of discoveredTokens) {
    let finalStatus: LiquidityStatus = "NO_LIQUIDITY";
    let usdValue = 0;
    let price = 0;

    // A. Try 0x Quote (Pure price)
    try {
      const quote = await get0xPrice(token.address, TOKENS.USDC, token.balance.toString());
      if (quote) {
        usdValue = Number(quote.buyAmount) / 1e6;
        const formattedBalance = Number(token.balance) / Math.pow(10, token.decimals);
        price = usdValue / formattedBalance;
        finalStatus = "PRICED";
      }
    } catch (e) {
      console.warn(`[Scanner] 0x failed for ${token.symbol}`);
    }

    // B. Liquidity detection (if not priced by 0x)
    if (finalStatus !== "PRICED") {
      try {
        const discovery = await discoverPools(token.address);
        if (discovery.hasPool) {
          finalStatus = "HIDDEN";
          console.log(`[Scanner] ${token.symbol} is HIDDEN (Pool on ${discovery.dexSource})`);
        }
      } catch (e) {}
    }

    enrichedTokens.push({
      ...token,
      usdValue,
      status: finalStatus,
      price
    });
  }

  console.log(`[Scanner] Enrichment complete. Found ${enrichedTokens.filter(t => t.status === "PRICED").length} priced tokens.`);
  return enrichedTokens;
}
