// src/config/contracts.ts
// All deployed contract addresses on Base Mainnet (chainId: 8453)

export const CHAIN_ID = 8453; // Base Mainnet

// ─── CoinBin Protocol Settings ───────────────────────────────────────────────
// ⚠️  استبدل هذا العنوان بعنوان محفظتك لاستقبال الرسوم
export const FEE_RECIPIENT = "0xYourWalletAddressHere" as const;

// رسوم البروتوكول: 30 = 0.30% من كل صفقة
// مثال: مستخدم يبيع $1000 → تحصل على $3.00
export const PROTOCOL_FEE_BPS = BigInt(30); // basis points (30 / 10000 = 0.3%)

// عنوان الحرق الكوني — لا أحد يملك المفتاح الخاص لهذا العنوان
export const BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD" as const;

// الحد الأدنى لقيمة التوكن بالـ USDC لمحاولة البيع (أقل من كده → حرق مباشر)
// 6 decimals لـ USDC: 1000 = $0.001
export const MIN_SWAP_VALUE_USDC = BigInt(1000); // $0.001

// ─── Uniswap V3 on Base ───────────────────────────────────────────────────────
export const UNISWAP_V3_ROUTER = "0x2626664c2603336E57B271c5C0b26F421741e481" as const;
export const UNISWAP_V3_QUOTER = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a" as const;

// ─── Key Token Addresses on Base ─────────────────────────────────────────────
export const TOKENS = {
  USDC:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const,
  WETH:  "0x4200000000000000000000000000000000000006" as const,
  cbBTC: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf" as const,
  DAI:   "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb" as const,
} as const;

// Fee tiers for Uniswap V3 pools (in hundredths of a bip)
export const FEE_TIERS = {
  LOWEST:  100,   // 0.01% — stable pairs
  LOW:     500,   // 0.05% — stable/correlated
  MEDIUM:  3000,  // 0.30% — most pairs
  HIGH:    10000, // 1.00%  — exotic pairs
} as const;

// ─── ERC-20 ABI (minimal — only what we need) ────────────────────────────────
export const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

// ─── Uniswap V3 SwapRouter ABI (exactInputSingle) ───────────────────────────
export const SWAP_ROUTER_ABI = [
  {
    name: "exactInputSingle",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    name: "multicall",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "data", type: "bytes[]" }],
    outputs: [{ name: "results", type: "bytes[]" }],
  },
] as const;

// ─── Uniswap V3 Quoter ABI ───────────────────────────────────────────────────
export const QUOTER_ABI = [
  {
    name: "quoteExactInputSingle",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

// ─── Multicall3 (already deployed on Base at canonical address) ───────────────
export const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;
export const MULTICALL3_ABI = [
  {
    name: "aggregate3",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "allowFailure", type: "bool" },
          { name: "value", type: "uint256" },
          { name: "callData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      {
        name: "returnData",
        type: "tuple[]",
        components: [
          { name: "success", type: "bool" },
          { name: "returnData", type: "bytes" },
        ],
      },
    ],
  },
] as const;
