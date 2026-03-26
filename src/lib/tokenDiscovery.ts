// src/lib/tokenDiscovery.ts
import { ethers } from "ethers";
import { KNOWN_TOKENS, fetchBaseTokenList } from "./tokens";

const RPC_URL = "https://mainnet.base.org";
const provider = new ethers.JsonRpcProvider(RPC_URL);

/**
 * Aggregates a comprehensive list of token addresses to scan
 */
export async function discoverAddressList(account: string): Promise<string[]> {
  const addresses = new Set<string>();

  console.log(`[Discovery] Starting discovery for ${account}...`);

  // 1. Known Tokens Registry (Curated in-app list)
  KNOWN_TOKENS.forEach(t => addresses.add(t.address.toLowerCase()));
  
  // 1b. Fallback Popular Base Tokens (Safety net for high-volume assets)
  const popularBase = [
    "0x532F3Eff7B64E9DBF6f16E21C96d8Cd5a20E45e7", // BRETT
    "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed", // DEGEN
    "0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4", // TOSHI
    "0x940181a94A35A4569E4529A3CDfB74e38FD98631", // AERO
    "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b", // VIRTUAL
    "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", // cbETH
    "0xcB79157C279d04172421768872d19688b02e79C2", // MOG
    "0xFF8adeC2221f9f4D8dfbAFa6B9a297d17603493D", // WELL
  ];
  popularBase.forEach(addr => addresses.add(addr.toLowerCase()));
  
  console.log(`[Discovery] Added ${addresses.size} tokens from internal registries.`);

  // 2. Official Base Token List (Optimism/Uniswap)
  try {
    const baseList = await fetchBaseTokenList();
    baseList.forEach(addr => addresses.add(addr.toLowerCase()));
    console.log(`[Discovery] Added ${baseList.length} tokens from official list.`);
  } catch (e) {
    console.warn("[Discovery] Official list fetch failed, skipping...");
  }

  // 3. ERC20 Transfer Log Scan (Discovery of historic activity)
  // We scan the last 20,000 blocks to find tokens recently moved
  try {
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - 20000; 

    // Filter: Transfer(address from, address to, uint256 value)
    const transferTopic = ethers.id("Transfer(address,address,uint256)");
    const walletTopic = ethers.zeroPadValue(account, 32);

    // Logs where wallet is the recipient
    const toLogs = await provider.getLogs({
      fromBlock,
      toBlock: 'latest',
      topics: [transferTopic, null, walletTopic]
    });

    // Logs where wallet is the sender
    const fromLogs = await provider.getLogs({
      fromBlock,
      toBlock: 'latest',
      topics: [transferTopic, walletTopic, null]
    });

    [...toLogs, ...fromLogs].forEach(log => {
      addresses.add(log.address.toLowerCase());
    });

    console.log(`[Discovery] Found ${toLogs.length + fromLogs.length} historic transfer logs.`);
  } catch (e) {
    console.warn("[Discovery] Log scanning failed (ignoring):", e);
  }

  const finalResult = Array.from(addresses);
  console.log(`[Discovery] Total unique addresses to scan: ${finalResult.length}`);
  
  return finalResult;
}
