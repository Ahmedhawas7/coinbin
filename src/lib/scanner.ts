// src/lib/scanner.ts
import { ethers } from "ethers";
import { MULTICALL3_ADDRESS, MULTICALL3_ABI, ERC20_ABI, TOKENS } from "@/config/contracts";
import { discoverPools } from "./liquidity";
import { get0xPrice } from "./0x";
import { discoverAddressList } from "./tokenDiscovery";
import { getDexScreenerPrices } from "./dexscreener";

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
 * PHASE 2 & 3: SCAN & ENRICH
 * Scans discovered addresses for balances and metadata, then adds pricing/liquidity.
 */
export async function scanTokens(account: string): Promise<ScannedToken[]> {
  console.log(`[Scanner] 🚀 Starting Wallet-First scan for ${account}`);
  
  // 1. Discovery Phase
  const potentialAddresses = await discoverAddressList(account);
  console.log(`[Scanner] 🔎 Discovery finished. Scanning ${potentialAddresses.length} addresses for balances...`);

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
  const CHUNK_SIZE = 120; // Slightly larger chunks for discovery
  const multicallResults: any[] = [];
  for (let i = 0; i < calls.length; i += CHUNK_SIZE) {
    const chunk = calls.slice(i, i + CHUNK_SIZE);
    try {
      const chunkRes = await multicall.aggregate3(chunk);
      multicallResults.push(...chunkRes);
    } catch (e) {
      console.error(`[Scanner] ❌ Multicall chunk ${i} failed`, e);
      multicallResults.push(...new Array(chunk.length).fill({ success: false, returnData: "0x" }));
    }
  }

  const discoveredTokens: ScannedToken[] = [];

  // Parse Multicall Results
  for (let i = 0; i < potentialAddresses.length; i++) {
    const addr = potentialAddresses[i];
    const resBase = i * 4;
    
    const balanceRes = multicallResults[resBase];
    const decimalsRes = multicallResults[resBase + 1];
    const symbolRes = multicallResults[resBase + 2];
    const nameRes = multicallResults[resBase + 3];

    if (!balanceRes?.success) continue;

    try {
      const balance = ethers.toBigInt(balanceRes.returnData);
      if (balance === 0n) continue;

      const decimals = decimalsRes?.success ? Number(ethers.toBigInt(decimalsRes.returnData)) : 18;
      const symbol = symbolRes?.success ? erc20.decodeFunctionResult("symbol", symbolRes.returnData)[0] : "???";
      const name = nameRes?.success ? erc20.decodeFunctionResult("name", nameRes.returnData)[0] : "Unknown Token";

      console.log(`[Scanner] ✅ FOUND: ${symbol} (${name}) | Balance: ${ethers.formatUnits(balance, decimals)} | ${addr}`);

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

  if (discoveredTokens.length === 0) {
    console.warn(`[Scanner] ⚠️ No tokens with balance > 0 found after scanning ${potentialAddresses.length} addresses.`);
    return [];
  }

  console.log(`[Scanner] ✨ Discovery complete. Found ${discoveredTokens.length} active tokens. Starting enrichment...`);

  // 3. Enrichment (Sequential for 0x API to respect rate limits)
  const enrichedTokens: ScannedToken[] = [];
  
  // Fetch WETH price for HIDDEN pricing fallback
  let wethPrice = 2500; // Fallback
  try {
    const wethQuote = await get0xPrice(TOKENS.WETH, TOKENS.USDC, "1000000000000000000");
    if (wethQuote) wethPrice = Number(wethQuote.buyAmount) / 1e6;
  } catch (e) {}

  // NEW: Fetch DexScreener Prices as a base truth fallback
  const dexscreenerPrices = await getDexScreenerPrices(discoveredTokens.map(t => t.address));
  console.log(`[Scanner] 📈 DexScreener priced ${dexscreenerPrices.size} tokens.`);

  for (const token of discoveredTokens) {
    let finalStatus: LiquidityStatus = "NO_LIQUIDITY";
    let usdValue = 0;
    let price = 0;
    const formattedBalance = Number(token.balance) / Math.pow(10, token.decimals);

    // Apply DexScreener as Fallback initial baseline
    const dsPrice = dexscreenerPrices.get(token.address.toLowerCase());
    if (dsPrice) {
      price = dsPrice;
      usdValue = price * formattedBalance;
      // Mark as HIDDEN so UI shows it with a price. If 0x quotes, it upgrades to PRICED.
      finalStatus = "HIDDEN"; 
    }

    // A. Try 0x Quote (Pure price)
    try {
      const quote = await get0xPrice(token.address, TOKENS.USDC, token.balance.toString());
      if (quote) {
        usdValue = Number(quote.buyAmount) / 1e6;
        price = usdValue / formattedBalance;
        finalStatus = "PRICED";
        console.log(`[Scanner] 💰 PRICED: ${token.symbol} = $${usdValue.toFixed(2)} (via 0x)`);
      }
    } catch (e) {
      console.warn(`[Scanner] 0x quote failed for ${token.symbol}, trying deep route discovery...`);
    }

    // B. Deep Liquidity detection (if not priced by 0x)
    if (finalStatus !== "PRICED") {
      try {
        const discovery = await discoverPools(token.address, token.balance);
        if (discovery.hasPool && discovery.bestAmountOut > 0n) {
          finalStatus = "HIDDEN";
          
          // Calculate price based on bestAmountOut and base asset
          const outNum = Number(discovery.bestAmountOut);
          if (discovery.bestBaseToken.toLowerCase() === TOKENS.USDC.toLowerCase() || 
              discovery.bestBaseToken.toLowerCase() === "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca") {
            usdValue = outNum / 1e6;
          } else if (discovery.bestBaseToken.toLowerCase() === TOKENS.WETH.toLowerCase()) {
            usdValue = (outNum / 1e18) * wethPrice;
          }

          price = usdValue / formattedBalance;
          console.log(`[Scanner] 🔍 HIDDEN: ${token.symbol} = $${usdValue.toFixed(2)} (via ${discovery.dexSource} | Best Out: ${discovery.bestAmountOut})`);
        } else {
          // Keep DexScreener HIDDEN status/values if we have them and discovery failed
          if (dsPrice) {
            console.log(`[Scanner] 📉 FALLBACK DXR: ${token.symbol} = $${usdValue.toFixed(2)} (via DexScreener)`);
          } else {
            console.log(`[Scanner] 💀 NO_LIQUIDITY: ${token.symbol}`);
          }
        }
      } catch (e) {
        console.error(`[Scanner] Deep discovery failed for ${token.symbol}:`, e);
      }
    }

    enrichedTokens.push({
      ...token,
      usdValue,
      status: finalStatus,
      price
    });
  }

  return enrichedTokens;
}
