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

  // 3. Blockscout Base API (Complete Historical Token Balances)
  // This replaces the 20,000 block log scan, providing all tokens ever owned by the wallet
  let nextPagePath: string | null = `/api/v2/addresses/${account}/token-balances`;
  try {
    while (nextPagePath) {
      const url: string = `https://base.blockscout.com${nextPagePath}`;
      const res: Response = await fetch(url);
      if (!res.ok) break;

      const data: any = await res.json();
      if (Array.isArray(data.items)) {
        data.items.forEach((item: any) => {
          if (item?.token?.address) {
            addresses.add(item.token.address.toLowerCase());
          }
        });
      }

      nextPagePath = data.next_page_params 
        ? `/api/v2/addresses/${account}/token-balances?` + new URLSearchParams(data.next_page_params).toString()
        : null;
    }
    console.log(`[Discovery] Complete Blockscout scan finished.`);
  } catch (e) {
    console.warn("[Discovery] Blockscout API failed (ignoring):", e);
  }

  // 4. (Fallback) ERC20 Transfer Log Scan if Blockscout is down
  // We scan the last 10,000 blocks to find tokens recently moved as a last resort
  if (addresses.size < popularBase.length + 50) {
    try {
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = currentBlock - 10000; 

      const transferTopic = ethers.id("Transfer(address,address,uint256)");
      const walletTopic = ethers.zeroPadValue(account, 32);

      const toLogs = await provider.getLogs({
        fromBlock,
        toBlock: 'latest',
        topics: [transferTopic, null, walletTopic]
      });

      const fromLogs = await provider.getLogs({
        fromBlock,
        toBlock: 'latest',
        topics: [transferTopic, walletTopic, null]
      });

      [...toLogs, ...fromLogs].forEach(log => {
        addresses.add(log.address.toLowerCase());
      });

      console.log(`[Discovery] Found ${toLogs.length + fromLogs.length} recent transfer logs via RPC fallback.`);
    } catch (e) {
      console.warn("[Discovery] RPC Fallback Log scanning failed:", e);
    }
  }

  const finalResult = Array.from(addresses);
  console.log(`[Discovery] Total unique addresses to scan: ${finalResult.length}`);
  
  return finalResult;
}
