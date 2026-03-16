// src/config/wagmi.ts
import { http, createConfig } from "wagmi";
import { base } from "wagmi/chains";
import { coinbaseWallet, metaMask, walletConnect } from "wagmi/connectors";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    coinbaseWallet({
      appName: "CoinBin",
      appLogoUrl: "https://base.org/favicon.ico",
      preference: "eoaOnly",
    }),
    metaMask(),
    walletConnect({ projectId }),
  ],
  transports: {
    [base.id]: http(
      `https://api.developer.coinbase.com/rpc/v1/base/${process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}`
    ),
  },
  ssr: true,
});
