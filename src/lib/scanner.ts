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

export async function scanTokens(
  account: string,
  tokenAddresses: string[]
): Promise<ScannedToken[]> {
  const multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);
  
  const calls = [];
  for (const addr of tokenAddresses) {
    const erc20 = new ethers.Interface(ERC20_ABI);
    calls.push({
      target: addr,
      allowFailure: true,
      callData: erc20.encodeFunctionData("balanceOf", [account]),
    });
    calls.push({
      target: addr,
      allowFailure: true,
      callData: erc20.encodeFunctionData("decimals"),
    });
    calls.push({
      target: addr,
      allowFailure: true,
      callData: erc20.encodeFunctionData("symbol"),
    });
  }

  const results = await multicall.aggregate3(calls);
  
  const scannedTokens: ScannedToken[] = [];
  
  for (let i = 0; i < tokenAddresses.length; i++) {
    const addr = tokenAddresses[i];
    const balanceRes = results[i * 3];
    const decimalsRes = results[i * 3 + 1];
    const symbolRes = results[i * 3 + 2];
    
    if (!balanceRes.success || !decimalsRes.success) continue;
    
    const balance = ethers.toBigInt(balanceRes.returnData);
    if (balance === 0n) continue;
    
    const decimals = Number(ethers.toBigInt(decimalsRes.returnData));

    const symbol = new ethers.Interface(ERC20_ABI).decodeFunctionResult("symbol", symbolRes.returnData)[0];
    
    // Check liquidity
    const { status, bestAmountOut } = await checkLiquidity(addr, balance);
    
    // Try 0x for better pricing if liquid
    let usdValue = 0;
    let price = 0;
    let finalStatus = status;

    if (status === "PRICED") {
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
    } else {
       // Check if it's dead or just no liquidity
       finalStatus = balance > 0n ? "NO_LIQUIDITY" : "DEAD";
    }

    scannedTokens.push({
      address: addr,
      symbol: symbol || "???",
      decimals,
      balance,
      usdValue,
      status: finalStatus,
      price,
    });
  }

  return scannedTokens;
}
