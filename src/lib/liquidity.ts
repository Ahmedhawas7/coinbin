// src/lib/liquidity.ts
import { ethers } from "ethers";
import { TOKENS } from "@/config/contracts";

const RPC_URL = "https://mainnet.base.org";
const provider = new ethers.JsonRpcProvider(RPC_URL);

// Standard Router/Quoter Addresses on Base
const UNISWAP_V2_ROUTER = "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24";
const UNISWAP_V3_QUOTER = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a";
const AERODROME_ROUTER = "0x9401518c4cc1ee5021bc4b2a3333f2402bd099c1";
const BASESWAP_ROUTER = "0x327Df1E6de55d39693ef2dB97316A734D7A13B6B";

const V2_ABI = ["function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"];
const V3_QUOTER_ABI = ["function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) public returns (uint256 amountOut)"];
const AERODROME_ABI = [
  "function getAmountsOut(uint amountIn, (address from, address to, bool stable)[] calldata routes) external view returns (uint[] memory amounts)"
];

export type LiquidityStatus = "PRICED" | "HIDDEN" | "NO_LIQUIDITY" | "DEAD";

export async function checkLiquidity(
  tokenAddress: string,
  amountIn: bigint
): Promise<{ status: LiquidityStatus; bestAmountOut: bigint }> {
  if (tokenAddress.toLowerCase() === TOKENS.USDC.toLowerCase()) {
    return { status: "PRICED", bestAmountOut: amountIn };
  }

  let bestAmountOut = BigInt(0);

  // 1. Check Uniswap V2 / BaseSwap (V2 Clones)
  const v2Routers = [UNISWAP_V2_ROUTER, BASESWAP_ROUTER];
  for (const router of v2Routers) {
    try {
      const contract = new ethers.Contract(router, V2_ABI, provider);
      const amounts = await contract.getAmountsOut(amountIn, [tokenAddress, TOKENS.USDC]);
      if (amounts[1] > bestAmountOut) bestAmountOut = BigInt(amounts[1]);
    } catch (e) {}
  }

  // 2. Check Aerodrome
  try {
    const contract = new ethers.Contract(AERODROME_ROUTER, AERODROME_ABI, provider);
    const routes = [{ from: tokenAddress, to: TOKENS.USDC, stable: false }];
    const amounts = await contract.getAmountsOut(amountIn, routes);
    if (amounts[amounts.length - 1] > bestAmountOut) bestAmountOut = BigInt(amounts[amounts.length - 1]);
  } catch (e) {}

  // 3. Check Uniswap V3
  const fees = [500, 3000, 10000];
  const v3Quoter = new ethers.Contract(UNISWAP_V3_QUOTER, V3_QUOTER_ABI, provider);
  for (const fee of fees) {
    try {
      // quoteExactInputSingle is a non-view function that reverts with the result in V3 Quoter V1, 
      // but in QuoterV2 it might be view. Let's try callStatic (staticCall in ethers v6)
      const amountOut = await v3Quoter.quoteExactInputSingle.staticCall(
        tokenAddress,
        TOKENS.USDC,
        fee,
        amountIn,
        0
      );
      if (BigInt(amountOut) > bestAmountOut) bestAmountOut = BigInt(amountOut);
    } catch (e) {}
  }

  if (bestAmountOut > 0n) {
    return { status: "PRICED", bestAmountOut };
  }

  return { status: "NO_LIQUIDITY", bestAmountOut: 0n };
}
