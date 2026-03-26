// src/lib/scanner.ts
import { ethers } from "ethers";
import { MULTICALL3_ADDRESS, MULTICALL3_ABI, ERC20_ABI, TOKENS } from "@/config/contracts";
import { checkLiquidity, type LiquidityStatus } from "./liquidity";
import { get0xPrice } from "./0x";

const RPC_URL = "https://mainnet.base.org";
const provider = new ethers.JsonRpcProvider(RPC_URL);

export interface ScannedToken {
  address: string;
  symbol: string;
  decimals: number;
  balance: bigint;
  usdValue: number;
  status: LiquidityStatus;
  price: number;
}

/**
 * Robustly scans for token balances with fallback logic
 */
export async function scanTokens(
  account: string,
  tokenAddresses: string[]
): Promise<ScannedToken[]> {
  console.log(`[Scanner] Starting scan for ${tokenAddresses.length} tokens for ${account}`);
  const multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);
  const erc20Interface = new ethers.Interface(ERC20_ABI);
  
  const calls = [];
  for (const addr of tokenAddresses) {
    calls.push({ target: addr, allowFailure: true, callData: erc20Interface.encodeFunctionData("balanceOf", [account]) });
    calls.push({ target: addr, allowFailure: true, callData: erc20Interface.encodeFunctionData("decimals") });
    calls.push({ target: addr, allowFailure: true, callData: erc20Interface.encodeFunctionData("symbol") });
  }

  let results: any[] = [];
  try {
    results = await multicall.aggregate3(calls);
  } catch (err) {
    console.error(`[Scanner] Multicall aggregate3 failed! Falling back to individual calls.`, err);
    // Partial results fallback logic handled below per token
  }

  const scannedTokens: ScannedToken[] = [];
  
  for (let i = 0; i < tokenAddresses.length; i++) {
    const addr = tokenAddresses[i];
    let balance: bigint = 0n;
    let decimals: number = 18;
    let symbol: string = "???";

    const baseIdx = i * 3;
    const balanceRes = results[baseIdx];
    const decimalsRes = results[baseIdx + 1];
    const symbolRes = results[baseIdx + 2];

    try {
      // 1. Get Balance
      if (balanceRes?.success) {
        balance = ethers.toBigInt(balanceRes.returnData);
      } else {
        const contract = new ethers.Contract(addr, ["function balanceOf(address) view returns (uint256)"], provider);
        balance = await contract.balanceOf(account).catch(() => 0n);
      }

      if (balance === 0n) continue;

      // 2. Get Decimals
      if (decimalsRes?.success) {
        decimals = Number(ethers.toBigInt(decimalsRes.returnData));
      } else {
        const contract = new ethers.Contract(addr, ["function decimals() view returns (uint8)"], provider);
        decimals = await contract.decimals().then(Number).catch(() => 18);
      }

      // 3. Get Symbol
      if (symbolRes?.success) {
        try {
          symbol = erc20Interface.decodeFunctionResult("symbol", symbolRes.returnData)[0];
        } catch { symbol = "???"; }
      } else {
        const contract = new ethers.Contract(addr, ["function symbol() view returns (string)"], provider);
        symbol = await contract.symbol().catch(() => "???");
      }

      console.log(`[Scanner] Found token: ${symbol} (${addr}) | Balance: ${balance.toString()}`);

      // 4. Initial Categorization (Liquidity check)
      let status: LiquidityStatus = "NO_LIQUIDITY";
      let usdValue = 0;
      let price = 0;

      try {
        const { status: liqStatus, bestAmountOut } = await checkLiquidity(addr, balance);
        status = liqStatus;

        if (liqStatus === "PRICED") {
          const zeroxPrice = await get0xPrice(addr, TOKENS.USDC, balance.toString());
          if (zeroxPrice) {
            usdValue = Number(zeroxPrice.buyAmount) / 1e6;
            const balanceFormatted = Number(balance) / Math.pow(10, decimals);
            price = usdValue / balanceFormatted;
          } else {
            usdValue = Number(bestAmountOut) / 1e6;
            const balanceFormatted = Number(balance) / Math.pow(10, decimals);
            price = usdValue / balanceFormatted;
          }
        }
      } catch (liqErr) {
        console.warn(`[Scanner] Liquidity check failed for ${symbol}:`, liqErr);
        status = "HIDDEN"; // Mark as hidden if we couldn't check but have balance
      }

      scannedTokens.push({
        address: addr,
        symbol,
        decimals,
        balance,
        usdValue,
        status: balance > 0n && usdValue === 0 ? "NO_LIQUIDITY" : status,
        price,
      });

    } catch (tokenErr) {
      console.error(`[Scanner] Critical failure for token ${addr}:`, tokenErr);
    }
  }

  console.log(`[Scanner] Scan complete. Found ${scannedTokens.length} active tokens.`);
  return scannedTokens;
}
